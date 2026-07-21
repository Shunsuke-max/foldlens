import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { parseCifTokens, parseEntries, parseFiles } from './af3Parser';

describe('parseEntries', () => {
  it('matches structure, summary, and confidence output files', () => {
    const result = parseEntries([
      { path: 'job/seed-1_sample-0/demo_model.cif', text: 'data_demo' },
      {
        path: 'job/seed-1_sample-0/demo_summary_confidences.json',
        text: JSON.stringify({ ptm: 0.8, iptm: 0.9, ranking_score: 0.88, chain_ids: ['A', 'B'] }),
      },
      {
        path: 'job/seed-1_sample-0/demo_confidences.json',
        text: JSON.stringify({ pae: [[1, 2], [2, 1]], token_chain_ids: ['A', 'B'] }),
      },
    ], 'demo.zip');

    expect(result.jobName).toBe('demo');
    expect(result.predictions).toHaveLength(1);
    expect(result.predictions[0].summary.rankingScore).toBe(0.88);
    expect(result.predictions[0].confidence?.pae).toEqual([[1, 2], [2, 1]]);
    expect(result.chains.map((chain) => chain.id)).toEqual(['A', 'B']);
  });

  it('opens a bare mmCIF without confidence files', () => {
    const result = parseEntries([{ path: 'my_result_model.cif', text: 'data_result' }], 'result.cif');
    expect(result.jobName).toBe('my result');
    expect(result.notices).toContain('No PAE array was found; the structure is still available.');
  });

  it('maps atom-site rows to residue tokens and keeps ligand atoms distinct', () => {
    const cif = [
      'data_test', 'loop_', '_atom_site.group_PDB', '_atom_site.label_atom_id', '_atom_site.label_comp_id',
      '_atom_site.label_asym_id', '_atom_site.label_seq_id', '_atom_site.B_iso_or_equiv',
      '_atom_site.auth_seq_id', '_atom_site.auth_comp_id', '_atom_site.auth_asym_id',
      'ATOM N ALA A 1 82.0 10 ALA Q',
      'ATOM CA ALA A 1 86.0 10 ALA Q',
      'HETATM C1 LIG B 1 75.0 501 LIG L',
      'HETATM O1 LIG B 1 77.0 501 LIG L', '#',
    ].join('\n');
    const parsed = parseCifTokens(cif, ['Q', 'L']);
    expect(parsed.residues.map((token) => `${token.chainId}:${token.residueId}`)).toEqual(['Q:10', 'L:501', 'L:501']);
    expect(parsed.bFactors).toEqual([84, 75, 77]);
  });

  it('rejects an invalid PAE matrix instead of converting null to zero', () => {
    const result = parseEntries([
      { path: 'job_model.cif', text: 'data_job' },
      { path: 'job_confidences.json', text: JSON.stringify({ pae: [[1, null], [null, 1]], token_chain_ids: ['A', 'B'] }) },
    ], 'job');
    expect(result.predictions[0].confidence?.pae).toBeUndefined();
    expect(result.notices).toContain('No PAE array was found; the structure is still available.');
  });

  it('accepts numeric clash flags emitted by the AF3 reference implementation', () => {
    const result = parseEntries([
      { path: 'job_model.cif', text: 'data_job' },
      { path: 'job_summary_confidences.json', text: JSON.stringify({ has_clash: 1.0, chain_ids: ['A'] }) },
    ], 'job');
    expect(result.predictions[0].summary.hasClash).toBe(true);
  });

  it('does not reinterpret experimental B-factors as pLDDT for a bare CIF', () => {
    const cif = [
      'data_test', 'loop_', '_atom_site.group_PDB', '_atom_site.label_atom_id', '_atom_site.label_comp_id',
      '_atom_site.label_asym_id', '_atom_site.label_seq_id', '_atom_site.B_iso_or_equiv',
      'ATOM CA ALA A 1 21.0', '#',
    ].join('\n');
    const result = parseEntries([{ path: 'experimental.cif', text: cif }], 'experimental.cif');
    expect(result.predictions[0].confidence?.tokenPlddts).toBeUndefined();
  });

  it('uses array-shaped AlphaFold Server requests to classify ions', () => {
    const cif = [
      'data_test', 'loop_', '_atom_site.group_PDB', '_atom_site.label_atom_id', '_atom_site.label_comp_id',
      '_atom_site.label_asym_id', '_atom_site.label_seq_id', '_atom_site.B_iso_or_equiv',
      'ATOM CA ALA A 1 80.0', 'HETATM MG MG B 1 50.0', '#',
    ].join('\n');
    const request = [{ name: 'job', sequences: [
      { proteinChain: { sequence: 'A', count: 1 } },
      { ion: { ion: 'MG', count: 1 } },
    ], dialect: 'alphafoldserver', version: 1 }];
    const result = parseEntries([
      { path: 'job_model.cif', text: cif },
      { path: 'job_request.json', text: JSON.stringify(request) },
    ], 'job');
    expect(result.chains.map((chain) => [chain.id, chain.kind, chain.label])).toEqual([
      ['A', 'protein', 'Protein · Chain A'],
      ['B', 'ligand', 'Ion · MG'],
    ]);
  });

  it('deduplicates the official top-level model copy and preserves sample identity', () => {
    const cif = 'data_same_structure';
    const result = parseEntries([
      { path: 'job/job_model.cif', text: cif },
      { path: 'job/seed-42_sample-1/job_seed-42_sample-1_model.cif', text: cif },
      { path: 'job/seed-42_sample-1/job_seed-42_sample-1_summary_confidences.json', text: JSON.stringify({ ranking_score: 0.91, chain_ids: ['A'] }) },
    ], 'job.zip');
    expect(result.predictions).toHaveLength(1);
    expect(result.predictions[0]).toMatchObject({ seed: '42', sample: 1 });
    expect(result.notices.some((notice) => notice.includes('duplicate top-level structure copy'))).toBe(true);
  });

  it('excludes AlphaFold Server template hits and matches numbered confidence files exactly', () => {
    const entries = Array.from({ length: 5 }, (_, index) => [
      { path: `job/job_model_${index}.cif`, text: `data_prediction_${index}` },
      { path: `job/job_summary_confidences_${index}.json`, text: JSON.stringify({ ranking_score: 0.9 - index * 0.05, chain_ids: ['A'] }) },
      { path: `job/job_full_data_${index}.json`, text: JSON.stringify({ pae: [[index]], token_chain_ids: ['A'] }) },
    ]).flat();
    entries.push(
      { path: 'job/templates/job_template_hit_0_chains_a.cif', text: 'data_template_0' },
      { path: 'job/templates/job_template_hit_1_chains_a.cif', text: 'data_template_1' },
      { path: 'job/templates/job_template_hit_2_chains_a.cif', text: 'data_template_2' },
      { path: 'job/templates/job_template_hit_3_chains_a.cif', text: 'data_template_3' },
    );

    const result = parseEntries(entries, 'job');

    expect(result.predictions).toHaveLength(5);
    expect(result.predictions.map((prediction) => prediction.path)).toEqual(
      Array.from({ length: 5 }, (_, index) => `job/job_model_${index}.cif`),
    );
    expect(result.predictions.map((prediction) => prediction.confidence?.pae)).toEqual(
      Array.from({ length: 5 }, (_, index) => [[index]]),
    );
    expect(result.notices).toContain('4 auxiliary template structure files were skipped.');
  });

  it('does not attach confidence data from an unrelated structure', () => {
    const result = parseEntries([
      { path: 'job/target_model.cif', text: 'data_target' },
      { path: 'job/other_summary_confidences.json', text: JSON.stringify({ ranking_score: 0.99 }) },
      { path: 'job/other_confidences.json', text: JSON.stringify({ pae: [[1]] }) },
    ], 'job');

    expect(result.predictions[0].summary).toEqual({});
    expect(result.predictions[0].confidence?.pae).toBeUndefined();
  });

  it('uses AF3 input data to identify protein, nucleic-acid, and ligand entities', () => {
    const result = parseEntries([
      { path: 'complex_model.cif', text: 'data_complex' },
      { path: 'complex_summary_confidences.json', text: JSON.stringify({ chain_ids: ['A', 'R', 'L'] }) },
      { path: 'complex_data.json', text: JSON.stringify({ sequences: [
        { protein: { id: 'A', sequence: 'AAAA' } },
        { rna: { id: 'R', sequence: 'ACGU' } },
        { ligand: { id: 'L', ccdCodes: ['ATP'] } },
      ] }) },
    ], 'complex.zip');
    expect(result.chains.map((chain) => [chain.id, chain.kind, chain.label])).toEqual([
      ['A', 'protein', 'Protein · Chain A'],
      ['R', 'nucleic', 'RNA · Chain R'],
      ['L', 'ligand', 'Ligand · ATP'],
    ]);
  });

  it('fails explicitly for zstandard-compressed AF3 output', () => {
    expect(() => parseEntries([{ path: 'job_model.cif.zst', text: 'compressed' }], 'job.zip')).toThrow(/\.zst-compressed/);
  });

  it('opens a real ZIP boundary and matches one prediction end to end', async () => {
    const archive = zipSync({
      'job/seed-1_sample-0/job_model.cif': strToU8('data_job'),
      'job/seed-1_sample-0/job_summary_confidences.json': strToU8(JSON.stringify({ ranking_score: 0.91, chain_ids: ['A'] })),
      'job/seed-1_sample-0/job_confidences.json': strToU8(JSON.stringify({ pae: [[1]], token_chain_ids: ['A'] })),
    });
    const file = new File([archive], 'job.zip', { type: 'application/zip' });
    const result = await parseFiles([file]);
    expect(result.predictions[0].summary.rankingScore).toBe(0.91);
    expect(result.predictions[0].confidence?.pae).toEqual([[1]]);
  });
});
