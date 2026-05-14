When a tool call fails:

1. Read the error output carefully — most errors are specific and actionable.
2. For file/edit errors: re-read the target file, verify content matches your expectation, retry with corrected input.
3. For command errors: check the tool/dependency exists, verify working directory, inspect output.
4. If the same call fails twice with the same error, try an alternative approach rather than retrying the same thing.
5. After three failures on the same operation, stop and surface to the user: what you tried, what failed, what the error says, and what you think is wrong.
