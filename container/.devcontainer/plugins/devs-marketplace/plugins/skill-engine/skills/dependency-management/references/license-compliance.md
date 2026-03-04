# License Compliance Reference

## License Classification

| Category | Licenses | SPDX IDs | Obligations |
|----------|----------|----------|-------------|
| **Permissive** | MIT, BSD 2-Clause, BSD 3-Clause, Apache 2.0, ISC, Unlicense, CC0, Zlib | `MIT`, `BSD-2-Clause`, `BSD-3-Clause`, `Apache-2.0`, `ISC`, `Unlicense`, `CC0-1.0`, `Zlib` | Attribution in LICENSE file. Minimal restrictions. |
| **Weak Copyleft** | LGPL 2.1, LGPL 3.0, MPL 2.0, EPL 2.0 | `LGPL-2.1-only`, `LGPL-3.0-only`, `MPL-2.0`, `EPL-2.0` | Modifications to the library itself must be shared. Using as a dependency is fine. |
| **Strong Copyleft** | GPL 2.0, GPL 3.0, AGPL 3.0 | `GPL-2.0-only`, `GPL-3.0-only`, `AGPL-3.0-only` | Derivative works must use the same license. AGPL extends to network use. |
| **Non-Commercial** | CC BY-NC, various | `CC-BY-NC-4.0` | Cannot use in commercial products. |
| **Unknown / Custom** | Proprietary, no license, custom terms | — | Requires legal review. No license = all rights reserved by default. |

---

## Commercial Usage Implications

### Permissive Licenses (Low Risk)

Safe for all use cases including proprietary/commercial software. Main obligation is preserving copyright notices and license text, typically in a NOTICES or LICENSE file.

Apache 2.0 additionally includes a patent grant — it protects users from patent claims by contributors.

### Weak Copyleft (Medium Risk)

Safe when used as a **library dependency** without modification. If you modify the library's source code, those modifications must be released under the same license. Dynamic linking is generally safe; static linking may trigger copyleft depending on the license.

**MPL 2.0** is file-level copyleft — only modified files need to be shared, not the entire project.

### Strong Copyleft (High Risk)

**GPL**: Any software that links to or includes GPL code may be considered a derivative work, requiring the entire project to be released under GPL. This is incompatible with proprietary/closed-source distribution.

**AGPL**: Same as GPL, but also triggered by providing the software as a network service (SaaS). If users interact with AGPL code over a network, you must provide source code access.

**Impact on SaaS**: AGPL is the highest-risk license for SaaS products. A single AGPL dependency can require releasing your entire service's source code.

### No License / Unknown

Code without a license defaults to **all rights reserved**. You have no legal right to use, modify, or distribute it. Flag these for immediate review and either:
- Contact the author to request a license
- Replace the dependency with a licensed alternative

---

## Common License Conflicts

| Combination | Compatible? | Notes |
|-------------|-------------|-------|
| MIT + Apache-2.0 | Yes | Both permissive, no conflict |
| MIT + GPL-3.0 | One-way | GPL project can include MIT code; MIT project cannot include GPL code without becoming GPL |
| Apache-2.0 + GPL-2.0 | No | Patent clause conflict. Apache-2.0 is compatible with GPL-3.0 but not GPL-2.0 |
| LGPL + Proprietary | Yes (with care) | Use as a library via dynamic linking. Do not modify LGPL source in your codebase |
| GPL + Proprietary | No | Cannot combine in a single distributed work |
| AGPL + SaaS | Problematic | Network use triggers source disclosure |
| Any + Unlicensed | No | No license = no permission to use |

---

## Recommended Actions by Risk Level

| Risk Level | Action |
|-----------|--------|
| **Permissive only** | No action needed. Ensure LICENSE/NOTICES file includes all attributions. |
| **Weak copyleft present** | Verify the dependency is used as a library without source modifications. Document in compliance notes. |
| **Strong copyleft present** | Escalate to legal/management. Evaluate whether the dependency can be replaced. Document the dependency chain. |
| **AGPL in SaaS context** | Treat as critical. Either replace the dependency or prepare for source disclosure. |
| **Unknown/missing license** | Block the dependency. Do not use code without explicit license grants. |
| **License changed in update** | Check license changes before upgrading — some packages have changed from permissive to restrictive between versions. |

---

## Detection Patterns

Search for license information in this order:
1. `LICENSE`, `LICENSE.md`, `LICENSE.txt` in the package root
2. `license` field in `package.json` (Node.js)
3. `license` field in `Cargo.toml` (Rust)
4. `License` classifier in `pyproject.toml` or `setup.py` (Python)
5. SPDX identifier in source file headers
6. Package registry metadata (npm registry, PyPI, crates.io)
