# Third-party notices

## RCSB Protein Data Bank entry 4HLA

The bundled sample structure at `src/assets/4hla.cif` is RCSB PDB entry **4HLA**, an HIV-1 protease dimer in complex with darunavir (PDB ligand code `017`).

- Entry: https://www.rcsb.org/structure/4HLA
- PDB DOI: https://doi.org/10.2210/pdb4HLA/pdb
- Primary citation: Yedidi RS et al. *Antimicrobial Agents and Chemotherapy* 57, 4920–4927 (2013). https://doi.org/10.1128/AAC.00868-13

The sample confidence values and PAE matrix are illustrative FoldLens data. They are not experimental measurements and are not AlphaFold Server output.

## AlphaFold Server output

FoldLens does not bundle AlphaFold Server output. Users who open or redistribute their own output remain responsible for the [AlphaFold Server Output Terms of Use](https://alphafoldserver.com/output-terms), including non-commercial-use restrictions and required notices. FoldLens does not perform docking or screening.

## 3Dmol.js

FoldLens uses 3Dmol.js. 3Dmol.js incorporates code from GLmol, Three.js, and jQuery and is licensed under a BSD-3-Clause license.

Copyright (c) 2014, University of Pittsburgh and contributors  
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

The complete dependency license, including incorporated GLmol, Three.js, and jQuery notices, is distributed by the `3dmol` package as `node_modules/3dmol/LICENSE` after installation.

Suggested citation: Rego N, Koes D. 3Dmol.js: molecular visualization with WebGL. *Bioinformatics*. 2015;31(8):1322–1324. https://doi.org/10.1093/bioinformatics/btu829

## Other runtime libraries

The application also uses the following runtime libraries. Their complete license texts are distributed in each installed package:

- React and React DOM — MIT
- Express — MIT
- fflate — MIT
- Zod — MIT
- tsx — MIT
- OpenAI JavaScript SDK — Apache-2.0
- dotenv — BSD-2-Clause

See `package-lock.json` for the exact resolved versions and transitive dependency inventory.
