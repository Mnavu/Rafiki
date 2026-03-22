Launch bundle workflow

1. Refresh local data first:
   - `python manage.py migrate`
   - run the seed commands you want included

2. Rebuild the committed launch bundle:
   - `python manage.py build_launch_bundle`

3. Commit and push the updated `launch_bundle.json`.

4. On Render, set:
   - `AUTO_RESTORE_LAUNCH_BUNDLE=1`

5. Redeploy the backend.

6. After the restore is complete, set:
   - `AUTO_RESTORE_LAUNCH_BUNDLE=0`

The restore command is fingerprinted, so the same bundle SHA will not reload twice unless
`--force` is used. When a new bundle is committed and the env flag is on, the deploy will
flush the target database and load the new bundle.
