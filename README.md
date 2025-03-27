# Check CodeScanning Alerts

This GitHub Action checks for open **CodeScanning** alerts in a repository and validates them against configurable thresholds for critical and high severities. It dynamically supports outputs for all severity levels found in the alerts, making it flexible for various use cases.

## Features

- Checks open **CodeScanning** alerts in a repository.
- Validates alerts against configurable thresholds for critical and high severities.
- Dynamically supports all severity levels (e.g., medium, low, etc.).
- Works with both Pull Request workflows and direct commit workflows.
- Updates or creates a **Comment** in GitHub with the results.
- Allows skipping failures in Pull Requests with the `do_not_break_pr_check` option.

---

## Configuration

### Prerequisites

1. Ensure **CodeScanning** is enabled in the repository.
2. Configure a workflow in GitHub Actions to use this Action.

---

## Inputs

The following inputs can be configured in the workflow:

| Input                  | Description                                                                 | Required | Default                          |
|------------------------|---------------------------------------------------------------------------|----------|----------------------------------|
| `github_token`         | The GitHub token used to authenticate API requests.                        | No       | `${{ github.token }}`           |
| `owner`                | The owner of the repository.                                               | No       | `${{ github.repository_owner }}`|
| `repo`                 | The name of the repository.                                                | No       | `${{ github.event.repository.name }}` |
| `max_high_alerts`      | Maximum allowed high severity alerts.                                      | No       | None (will only notify but will not break)                             |
| `max_critical_alerts`  | Maximum allowed critical severity alerts.                                  | No       | None (will only notify but will not break)                             |                              |
| `max_medium_alerts`      | Maximum allowed medium severity alerts.                                      | No       | None (will only notify but will not break)                             |
| `max_low_alerts`      | Maximum allowed low severity alerts.                                      | No       | None (will only notify but will not break)                             |
| `max_note_alerts`      | Maximum allowed note severity alerts.                                      | No       | None (will only notify but will not break)                             |
| `do_not_break_pr_check`| Do not fail the PR check if thresholds are exceeded.                       | No       | `false`                          |

---

## Outputs

The following outputs are provided by the Action:

| Output             | Description                                    |
|--------------------|----------------------------------------------|
| `<severity>_alerts`| Number of alerts for each dynamically detected severity (e.g., `medium_alerts`, `low_alerts`). |
| `total_alerts`  | Number of all severity alerts.           |
| `conclusion`      | Is this check a final success or a final failure?   |
> **Note**: Dynamic outputs are automatically generated based on the severity levels found in the alerts.

---

## How to Use

### Example Workflow

Create a workflow file in the repository, such as `.github/workflows/code-scanning.yml`, with the following content:

```yaml
name: CodeScanning Alerts Check

on:
  push:
    branches:
      - main
  pull_request:

jobs:
  check-alerts:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run CodeScanning Alerts Check
        uses: lfventura/codescanning-alerts@main
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          max_high_alerts: 5
          max_critical_alerts: 2
          do_not_break_pr_check: false

---

## Workflow Explanation

1. **Triggers**:
   - The workflow runs on `push` events to the `main` branch and on `pull_request` events.

2. **Steps**:
   - **Checkout the code**: Uses the `actions/checkout` Action to fetch the repository code.
   - **Run the Action**: Executes the `Check CodeScanning Alerts` Action with the configured inputs.

3. **Configured Inputs**:
   - `github_token`: Token for authentication (automatically provided by GitHub Actions).
   - `max_high_alerts`: Threshold for high severity alerts (set to 5 in this example).
   - `max_critical_alerts`: Threshold for critical severity alerts (set to 2 in this example).
   - `do_not_break_pr_check`: Set to `false` to fail the check if thresholds are exceeded.

---

## Customization

You can customize the inputs in the workflow to suit your needs. For example:

- To ignore failures in Pull Requests:
  ```yaml
  with:
    do_not_break_pr_check: true
  ```

- To adjust alert thresholds:
  ```yaml
  with:
    max_high_alerts: 10
    max_critical_alerts: 5
  ```

---

## Results

### GitHub Display

- A **Check Run** will be created or updated in GitHub with the name `Code Scanning Alerts`.
- The result will be displayed directly in the Pull Request interface or in the commit history.

### Possible Conclusions

- **`success`**: No alerts exceed the configured thresholds.
- **`failure`**: Alerts exceed the configured thresholds.

---

## Dynamic Severities

This Action supports dynamic severities. In addition to `critical` and `high`, any other severity levels found in the alerts (e.g., `medium`, `low`, etc.) will be automatically processed and reported as outputs.

For example:
- If alerts with `medium` severity are found, the output `medium_alerts` will be generated.
- If alerts with `low` severity are found, the output `low_alerts` will be generated.

---

## Some other useful info

- You can test the module locally:
  - npx local-action . src/run.ts .env

---

## Branding

- **Icon**: 🛡️ (shield)
- **Color**: Red (`red`)

---

## More Examples

Check .github/workflow folder for some examples on how to use.

---

## Further help
To get more help on the Actions see [documentation](https://docs.github.com/en/actions).

---

## Contribution

Feel free to submit pull requests for improvements.

---

## License

This project is licensed under the [MIT License](LICENSE).

---
