import { strFromU8, unzip } from 'fflate';
import type { AF3Confidence, AF3Result, AF3Summary, ChainInfo, Prediction, TokenResidue } from '../types/af3';

type TextEntry = { path: string; text: string };
type JsonEntry = TextEntry & { value: Record<string, unknown> };

const CIF_EXT = /\.(?:cif|mmcif)$/i;
const JSON_EXT = /\.json$/i;
const SUPPORTED_EXT = /\.(?:cif|mmcif|json|csv|zst)$/i;
const COMPRESSED_AF3_EXT = /\.(?:cif|mmcif|json|csv)\.zst$/i;
const MAX_RELEVANT_BYTES = 256 * 1024 * 1024;
const CHAIN_COLORS = ['#42bdf5', '#a9d94a', '#367de8', '#aa73df', '#f0b455', '#e4779d'];
const NUCLEOTIDES = new Set(['A', 'C', 'G', 'U', 'T', 'DA', 'DC', 'DG', 'DT', 'DU']);
const AUXILIARY_STRUCTURE_DIRS = new Set(['template', 'templates', 'msa', 'msas', '__macosx']);

type EntityHint = Pick<ChainInfo, 'label' | 'kind' | 'range'>;

function fileStem(path: string) {
  return path.split('/').pop()!.replace(/\.(?:cif|mmcif|json|csv)$/i, '');
}

function directory(path: string) {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? '' : path.slice(0, slash);
}

function isAuxiliaryStructure(path: string) {
  const parts = path.split('/');
  const directories = parts.slice(0, -1).map((part) => part.toLowerCase());
  const filename = parts.at(-1) ?? path;
  return directories.some((part) => AUXILIARY_STRUCTURE_DIRS.has(part))
    || /(?:^|[_-])template[_-]hit(?:[_-]|$)/i.test(filename);
}

function artifactIdentity(path: string) {
  const match = fileStem(path).match(/^(.*?)(?:_(?:model|summary_confidences?|confidences?|full_data))(?:[_-](\d+))?$/i);
  if (!match) return undefined;
  return { base: match[1].toLowerCase(), index: match[2] };
}

function sampleIdentity(path: string) {
  const match = path.match(/seed[-_]?(\d+).*sample[-_]?(\d+)/i);
  return match ? `${match[1]}:${match[2]}` : undefined;
}

function artifactsMatch(cif: TextEntry, artifact: TextEntry) {
  if (directory(cif.path) !== directory(artifact.path)) return false;
  const cifIdentity = artifactIdentity(cif.path);
  const artifactFileIdentity = artifactIdentity(artifact.path);
  if (!cifIdentity || !artifactFileIdentity || cifIdentity.base !== artifactFileIdentity.base) return false;
  if (cifIdentity.index !== artifactFileIdentity.index) return false;
  return sampleIdentity(cif.path) === sampleIdentity(artifact.path);
}

function scalar(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function boolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function numberMatrix(value: unknown): number[][] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows = value.filter(Array.isArray).map((row) => row.map(Number).filter(Number.isFinite));
  return rows.length > 0 && rows.every((row) => row.length > 0) ? rows : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === 'string');
  return strings.length ? strings : undefined;
}

function numberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const numbers = value.map(Number);
  return numbers.length && numbers.every(Number.isFinite) ? numbers : undefined;
}

function tokenizeCifRow(line: string) {
  return line.match(/'(?:[^']|'')*'|"(?:[^"]|"")*"|\S+/g)?.map((token) => {
    if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"'))) return token.slice(1, -1);
    return token;
  }) ?? [];
}

export function parseCifTokens(cif: string, expectedChainIds?: string[]): { residues: TokenResidue[]; plddts: number[] } {
  const lines = cif.split(/\r?\n/);
  const loopIndex = lines.findIndex((line, index) => line.trim() === 'loop_' && lines[index + 1]?.trim().startsWith('_atom_site.'));
  if (loopIndex < 0) return { residues: [], plddts: [] };

  const headers: string[] = [];
  let rowIndex = loopIndex + 1;
  while (lines[rowIndex]?.trim().startsWith('_atom_site.')) {
    headers.push(lines[rowIndex].trim());
    rowIndex += 1;
  }

  const column = (name: string) => headers.indexOf(`_atom_site.${name}`);
  const groupColumn = column('group_PDB');
  const labelChainColumn = column('label_asym_id');
  const authChainColumn = column('auth_asym_id');
  const labelSeqColumn = column('label_seq_id');
  const authSeqColumn = column('auth_seq_id');
  const labelCompColumn = column('label_comp_id');
  const authCompColumn = column('auth_comp_id');
  const atomColumn = column('label_atom_id');
  const bFactorColumn = column('B_iso_or_equiv');
  const expected = new Set(expectedChainIds ?? []);
  const rows: string[][] = [];

  while (rowIndex < lines.length) {
    const line = lines[rowIndex].trim();
    if (!line || line === '#') break;
    if (line === 'loop_' || line.startsWith('_')) break;
    const tokens = tokenizeCifRow(line);
    if (tokens.length >= headers.length) rows.push(tokens);
    rowIndex += 1;
  }

  const labelHits = rows.reduce((count, row) => count + (expected.has(row[labelChainColumn]) ? 1 : 0), 0);
  const authHits = rows.reduce((count, row) => count + (expected.has(row[authChainColumn]) ? 1 : 0), 0);
  const chainColumn = authHits >= labelHits && authChainColumn >= 0 ? authChainColumn : labelChainColumn;
  const seqColumn = chainColumn === authChainColumn && authSeqColumn >= 0 ? authSeqColumn : labelSeqColumn;
  const compColumn = chainColumn === authChainColumn && authCompColumn >= 0 ? authCompColumn : labelCompColumn;
  if (chainColumn < 0 || seqColumn < 0) return { residues: [], plddts: [] };

  const tokens: Array<{ residue: TokenResidue; values: number[] }> = [];
  const tokenByKey = new Map<string, number>();
  for (const row of rows) {
    const chainId = row[chainColumn];
    const residueId = row[seqColumn];
    if (!chainId || chainId === '?' || chainId === '.' || !residueId || residueId === '?' || residueId === '.') continue;
    const group = groupColumn >= 0 ? row[groupColumn] : 'ATOM';
    const residueName = compColumn >= 0 ? row[compColumn] : undefined;
    const atomName = atomColumn >= 0 ? row[atomColumn] : '';
    const key = group === 'HETATM'
      ? `${chainId}:${residueId}:${residueName}:${atomName}`
      : `${chainId}:${residueId}:${residueName}`;
    let index = tokenByKey.get(key);
    if (index === undefined) {
      index = tokens.length;
      tokenByKey.set(key, index);
      const parsedNumber = Number.parseInt(residueId, 10);
      tokens.push({
        residue: {
          tokenIndex: index,
          chainId,
          residueId,
          residueNumber: Number.isFinite(parsedNumber) ? parsedNumber : undefined,
          residueName,
        },
        values: [],
      });
    }
    const value = bFactorColumn >= 0 ? Number(row[bFactorColumn]) : Number.NaN;
    if (Number.isFinite(value)) tokens[index].values.push(value);
  }

  return {
    residues: tokens.map((token) => token.residue),
    plddts: tokens.map((token) => token.values.length
      ? token.values.reduce((sum, value) => sum + value, 0) / token.values.length
      : Number.NaN),
  };
}

function parseSummary(value: Record<string, unknown>): AF3Summary | null {
  const summary: AF3Summary = {
    ptm: scalar(value.ptm ?? value.pTM),
    iptm: scalar(value.iptm ?? value.ipTM),
    rankingScore: scalar(value.ranking_score ?? value.rankingScore),
    hasClash: boolean(value.has_clash ?? value.hasClash),
    fractionDisordered: scalar(value.fraction_disordered ?? value.fractionDisordered),
    chainIds: stringArray(value.chain_ids ?? value.chainIds),
    chainPtm: numberArray(value.chain_ptm ?? value.chainPtm),
    chainIptm: numberArray(value.chain_iptm ?? value.chainIptm),
    chainPairIptm: numberMatrix(value.chain_pair_iptm ?? value.chainPairIptm),
    chainPairPaeMin: numberMatrix(value.chain_pair_pae_min ?? value.chainPairPaeMin),
  };
  return Object.values(summary).some((item) => item !== undefined) ? summary : null;
}

function parseConfidence(value: Record<string, unknown>): AF3Confidence | null {
  const confidence: AF3Confidence = {
    pae: numberMatrix(value.pae ?? value.full_pae ?? value.predicted_aligned_error),
    tokenChainIds: stringArray(value.token_chain_ids ?? value.tokenChainIds),
    tokenPlddts: numberArray(value.token_plddts ?? value.tokenPlddts),
    atomPlddts: numberArray(value.atom_plddts ?? value.atomPlddts),
    atomChainIds: stringArray(value.atom_chain_ids ?? value.atomChainIds),
    contactProbs: numberMatrix(value.contact_probs ?? value.contactProbs),
  };
  return Object.values(confidence).some((item) => item !== undefined) ? confidence : null;
}

function sharedNameScore(aPath: string, bPath: string) {
  let score = directory(aPath) === directory(bPath) ? 10 : 0;
  const a = fileStem(aPath).toLowerCase().split(/[_\-.]+/).filter(Boolean);
  const b = new Set(fileStem(bPath).toLowerCase().split(/[_\-.]+/).filter(Boolean));
  for (const token of a) {
    if (b.has(token) && !['model', 'summary', 'confidence', 'confidences'].includes(token)) score += 1;
  }
  const aSample = aPath.match(/(?:sample|model)[-_]?(\d+)/i)?.[1];
  const bSample = bPath.match(/(?:sample|model)[-_]?(\d+)/i)?.[1];
  if (aSample && bSample && aSample === bSample) score += 6;
  return score;
}

function closest<T extends TextEntry>(cif: TextEntry, entries: T[]) {
  return entries
    .filter((entry) => artifactsMatch(cif, entry))
    .sort((a, b) => sharedNameScore(cif.path, b.path) - sharedNameScore(cif.path, a.path))[0];
}

function humanizeJobName(path: string) {
  return fileStem(path)
    .replace(/(?:_seed[-_]?\d+)?(?:_sample[-_]?\d+)?_model(?:_\d+)?$/i, '')
    .replace(/^(?:fold[_-])?/i, '')
    .replace(/[_-]+/g, ' ')
    .trim() || 'AlphaFold 3 result';
}

function idsFor(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  return stringArray(value) ?? [];
}

function entityHints(entries: JsonEntry[]): Map<string, EntityHint> {
  const result = new Map<string, EntityHint>();
  for (const entry of entries) {
    const sequences = Array.isArray(entry.value.sequences) ? entry.value.sequences : [];
    for (const item of sequences) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const record = item as Record<string, unknown>;
      const definitions: Array<[string, ChainInfo['kind'], string]> = [
        ['protein', 'protein', 'Protein'], ['proteinChain', 'protein', 'Protein'],
        ['rna', 'nucleic', 'RNA'], ['rnaSequence', 'nucleic', 'RNA'],
        ['dna', 'nucleic', 'DNA'], ['dnaSequence', 'nucleic', 'DNA'],
        ['ligand', 'ligand', 'Ligand'], ['ion', 'ligand', 'Ion'],
      ];
      for (const [key, kind, name] of definitions) {
        const raw = record[key];
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const entity = raw as Record<string, unknown>;
        const sequence = typeof entity.sequence === 'string' ? entity.sequence : undefined;
        const ligandName = stringArray(entity.ccdCodes ?? entity.ccd_codes)?.join(', ')
          ?? (typeof entity.smiles === 'string' ? 'custom ligand' : undefined);
        for (const id of idsFor(entity.id ?? entity.ids)) {
          result.set(id, {
            kind,
            label: kind === 'ligand' && ligandName ? `${name} · ${ligandName}` : `${name} · Chain ${id}`,
            range: sequence ? `1–${sequence.replace(/\s/g, '').length}` : undefined,
          });
        }
      }
    }
  }
  return result;
}

function cifEntityHints(cif: string, expectedChainIds?: string[]): Map<string, EntityHint> {
  const parsed = parseCifTokens(cif, expectedChainIds);
  const byChain = new Map<string, TokenResidue[]>();
  parsed.residues.forEach((residue) => byChain.set(residue.chainId, [...(byChain.get(residue.chainId) ?? []), residue]));
  const result = new Map<string, EntityHint>();
  for (const [id, residues] of byChain) {
    const uniqueResidues = new Set(residues.map((residue) => residue.residueId));
    const names = residues.map((residue) => residue.residueName ?? '').filter(Boolean);
    const nucleic = names.length > 0 && names.every((name) => NUCLEOTIDES.has(name.toUpperCase()));
    const ligand = uniqueResidues.size <= 2 && residues.length > uniqueResidues.size * 2;
    const kind: ChainInfo['kind'] = nucleic ? 'nucleic' : ligand ? 'ligand' : 'protein';
    const numbers = residues.map((residue) => residue.residueNumber).filter((value): value is number => value !== undefined);
    const range = numbers.length ? `${Math.min(...numbers)}–${Math.max(...numbers)}` : undefined;
    result.set(id, { kind, label: `${nucleic ? 'Nucleic acid' : ligand ? 'Ligand' : 'Protein'} · Chain ${id}`, range });
  }
  return result;
}

function inferChains(summary: AF3Summary, confidence: AF3Confidence | undefined, hints: Map<string, EntityHint>): ChainInfo[] {
  const ids = summary.chainIds ?? [...new Set([...(confidence?.tokenChainIds ?? []), ...hints.keys()])];
  if (ids.length === 0) {
    return [
      { id: 'A', label: 'Chain A', kind: 'unknown', color: CHAIN_COLORS[0] },
    ];
  }
  return ids.map((id, index) => {
    const hint = hints.get(id);
    return { id, label: hint?.label ?? `Chain ${id}`, kind: hint?.kind ?? 'unknown', range: hint?.range, color: CHAIN_COLORS[index % CHAIN_COLORS.length] };
  });
}

function parseJsonEntries(entries: TextEntry[]) {
  const parsed: JsonEntry[] = [];
  for (const entry of entries.filter((item) => JSON_EXT.test(item.path))) {
    try {
      const value = JSON.parse(entry.text);
      if (value && typeof value === 'object' && !Array.isArray(value)) parsed.push({ ...entry, value });
    } catch {
      // Unrelated or partial JSON should not prevent the structure from opening.
    }
  }
  return parsed;
}

export function parseEntries(entries: TextEntry[], sourceName: string): AF3Result {
  if (entries.some((entry) => COMPRESSED_AF3_EXT.test(entry.path))) {
    throw new Error('This AF3 result contains .zst-compressed files. Decompress them first, or regenerate the output without --compress_large_output_files.');
  }
  const allCifs = entries.filter((entry) => CIF_EXT.test(entry.path));
  const auxiliaryCifs = allCifs.filter((entry) => isAuxiliaryStructure(entry.path));
  const rawCifs = allCifs.filter((entry) => !isAuxiliaryStructure(entry.path));
  const seenCif = new Set<string>();
  const cifEntries = [...rawCifs]
    .sort((a, b) => Number(/seed[-_]?\d+.*sample[-_]?\d+/i.test(b.path)) - Number(/seed[-_]?\d+.*sample[-_]?\d+/i.test(a.path)) || b.path.split('/').length - a.path.split('/').length)
    .filter((entry) => {
      if (seenCif.has(entry.text)) return false;
      seenCif.add(entry.text);
      return true;
    });
  if (cifEntries.length === 0) throw new Error('No .cif or .mmcif structure was found.');

  const jsonEntries = parseJsonEntries(entries);
  const summaries = jsonEntries
    .map((entry) => ({ ...entry, parsed: parseSummary(entry.value) }))
    .filter((entry): entry is JsonEntry & { parsed: AF3Summary } => Boolean(entry.parsed));
  const confidences = jsonEntries
    .map((entry) => ({ ...entry, parsed: parseConfidence(entry.value) }))
    .filter((entry): entry is JsonEntry & { parsed: AF3Confidence } => Boolean(entry.parsed));

  const predictions: Prediction[] = cifEntries.map((cif, index) => {
    const summaryEntry = closest(cif, summaries);
    const confidenceEntry = closest(cif, confidences);
    const parsedConfidence = confidenceEntry?.parsed;
    const cifTokens = parseCifTokens(cif.text, parsedConfidence?.tokenChainIds);
    const expectedTokens = parsedConfidence?.pae?.length ?? parsedConfidence?.tokenChainIds?.length;
    const alignedTokens = !expectedTokens || expectedTokens === cifTokens.residues.length;
    const identity = cif.path.match(/seed[-_]?(\d+).*sample[-_]?(\d+)/i);
    return {
      id: `${sourceName}-${index}`,
      label: `Model ${index + 1}`,
      path: cif.path,
      cif: cif.text,
      seed: identity?.[1],
      sample: identity?.[2] === undefined ? undefined : Number(identity[2]),
      summary: summaryEntry?.parsed ?? {},
      confidence: parsedConfidence || alignedTokens && cifTokens.residues.length ? {
        ...parsedConfidence,
        tokenChainIds: parsedConfidence?.tokenChainIds ?? (alignedTokens ? cifTokens.residues.map((token) => token.chainId) : undefined),
        tokenResidues: alignedTokens ? cifTokens.residues : undefined,
        tokenPlddts: parsedConfidence?.tokenPlddts ?? (alignedTokens && cifTokens.plddts.every(Number.isFinite) ? cifTokens.plddts : undefined),
      } : undefined,
    };
  });

  predictions.sort((a, b) => (b.summary.rankingScore ?? -1) - (a.summary.rankingScore ?? -1));
  predictions.forEach((prediction, index) => { prediction.label = `Model ${index + 1}`; });

  const top = predictions[0];
  const notices: string[] = [];
  if (!top.confidence?.pae) notices.push('No PAE array was found; the structure is still available.');
  const invalidJsonCount = entries.filter((entry) => JSON_EXT.test(entry.path)).length - jsonEntries.length;
  if (invalidJsonCount > 0) notices.push(`${invalidJsonCount} JSON ${invalidJsonCount === 1 ? 'file was' : 'files were'} ignored because the content was not a supported object.`);
  const duplicateCount = rawCifs.length - cifEntries.length;
  if (duplicateCount) notices.push(`${duplicateCount} duplicate top-level structure ${duplicateCount === 1 ? 'copy was' : 'copies were'} removed.`);
  if (auxiliaryCifs.length) notices.push(`${auxiliaryCifs.length} auxiliary template structure ${auxiliaryCifs.length === 1 ? 'file was' : 'files were'} skipped.`);
  if (predictions.length > 12) notices.push(`Showing the top 12 of ${predictions.length} predictions by ranking score.`);
  const hints = entityHints(jsonEntries);
  const inferred = cifEntityHints(top.cif, top.summary.chainIds ?? top.confidence?.tokenChainIds);
  for (const [id, hint] of inferred) if (!hints.has(id)) hints.set(id, hint);

  return {
    jobName: humanizeJobName(top.path),
    sourceName,
    predictions: predictions.slice(0, 12),
    chains: inferChains(top.summary, top.confidence, hints),
    notices,
    isDemo: false,
  };
}

export async function parseFiles(files: File[]): Promise<AF3Result> {
  if (files.length === 0) throw new Error('Choose an AlphaFold 3 ZIP, folder, CIF, or JSON output.');
  const zip = files.find((file) => /\.zip$/i.test(file.name));
  if (zip) {
    let relevantBytes = 0;
    let tooLarge = false;
    let ignoredFiles = 0;
    const zipBytes = new Uint8Array(await zip.arrayBuffer());
    const unzipped = await new Promise<Record<string, Uint8Array>>((resolve, reject) => unzip(zipBytes, {
      filter: (entry) => {
        if (!SUPPORTED_EXT.test(entry.name)) {
          if (entry.originalSize > 0 && !/(?:^|\/)__MACOSX\//.test(entry.name)) ignoredFiles += 1;
          return false;
        }
        relevantBytes += entry.originalSize;
        if (relevantBytes > MAX_RELEVANT_BYTES) {
          tooLarge = true;
          return false;
        }
        return true;
      },
    }, (error, data) => error ? reject(error) : resolve(data)));
    if (tooLarge) throw new Error('The relevant structure and confidence files exceed 256 MB. Open a smaller result or select only the top model files.');
    const entries = Object.entries(unzipped)
      .map(([path, bytes]) => ({ path, text: strFromU8(bytes) }));
    const result = parseEntries(entries, zip.name);
    if (ignoredFiles) result.notices.push(`${ignoredFiles} unrelated or large auxiliary ${ignoredFiles === 1 ? 'file was' : 'files were'} skipped during import.`);
    return result;
  }

  const supported = files.filter((file) => SUPPORTED_EXT.test(file.name));
  if (supported.some((file) => COMPRESSED_AF3_EXT.test(file.name))) {
    throw new Error('This AF3 result contains .zst-compressed files. Decompress them first, or regenerate the output without --compress_large_output_files.');
  }
  const totalBytes = supported.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_RELEVANT_BYTES) throw new Error('The selected structure and confidence files exceed 256 MB. Select only the top model files.');
  const entries = await Promise.all(supported.map(async (file) => ({
    path: file.webkitRelativePath || file.name,
    text: await file.text(),
  })));
  const result = parseEntries(entries, files[0].webkitRelativePath.split('/')[0] || files[0].name);
  const ignoredFiles = files.length - supported.length;
  if (ignoredFiles) result.notices.push(`${ignoredFiles} unsupported ${ignoredFiles === 1 ? 'file was' : 'files were'} skipped during import.`);
  return result;
}
