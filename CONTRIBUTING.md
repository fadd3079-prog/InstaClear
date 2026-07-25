# Contributing to InstaClear

InstaClear maintains a strict standard for code quality, architectural simplicity, and data privacy. We welcome technical contributions that align with our core philosophy.

<details>
<summary><b>Code of Conduct</b></summary>
<br>

All participants must engage with professionalism and technical rigor. Ad hominem attacks, inflammatory language, or non-constructive criticism will result in immediate repository ban. Focus on the code, architecture, and mathematical proofs of the proposed implementations.
</details>

<details>
<summary><b>Bug Reporting</b></summary>
<br>

Meta frequently updates their internal data structures. If you encounter a parsing failure, it is highly probable that the JSON schema for `followers_1.json` or `following.json` has mutated.

When submitting an issue, you **must** include:
1. The exact structural path that failed (e.g., `string_list_data[0].value`).
2. A sanitized, anonymized snippet of the new JSON structure.
3. Browser environment details and console stack traces.

Do **not** upload your raw export files. Maintain your own data privacy.
</details>

<details>
<summary><b>Pull Request Workflow</b></summary>
<br>

We enforce a strict Git workflow to maintain trunk stability:

1. **Branch Naming**: 
   - New features: `feat/describe-the-feature`
   - Bug fixes: `fix/describe-the-bug`
   - Refactors: `refactor/describe-the-refactor`
2. **Commit Messages**: Use imperative mood (e.g., "Add recursive JSON traversal", not "Added...").
3. **Validation**: You must test your logic against current, unmodified Meta JSON exports before submitting a PR.
4. **Dependencies**: InstaClear uses zero external JavaScript libraries. PRs introducing npm packages, bundlers, or third-party tracking scripts will be immediately rejected.

Submit your PR against the `main` branch. A maintainer will review the diff for security implications and architectural compliance.
</details>
