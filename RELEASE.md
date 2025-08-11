## Releasing a new version

The following step-by-step list is a simple checklist on how to create a new release of obsidian-pdf-printer.

1. Move all relevant new features/fixes to a common branch.
2. Add a new version tag to `package.json`, following semantic versioning guidelines.
3. Run `npm install` to ensure the new version tag is written to `package-lock.json`.
4. Add the new version to `manifest.json` (version) and `versions.json` (left-hand of the `:`).
5. Push the changes to the previously chosen common branch.
6. Create a tag and push the branch files (I am using main branch as an example here):
    ```bash
    git tag -a "[version e.g. 0.1.2]" -m "[same version]"
    git push origin [version]
    ```
