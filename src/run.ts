import * as core from "@actions/core";
import * as github from "@actions/github";

export async function run(): Promise<void> {
  try {
    // Get the inputs from the workflow file
    const token: string = core.getInput("github_token");
    const owner: string = core.getInput("owner");
    const repo: string = core.getInput("repo");
    const maxAlertsThreshold: Record<string, number> = {};
    const doNotBreakPRCheck: boolean =
      core.getInput("do_not_break_pr_check") === "true";
    ["critical", "high", "medium", "low", "note"].forEach((severity) => {
      maxAlertsThreshold[severity] = parseInt(
        core.getInput(`max_${severity}_alerts`),
        10,
      );
    });

    const octokit: ReturnType<typeof github.getOctokit> =
      github.getOctokit(token);

    // Fetch Code Scanning Alerts
    let alerts = await octokit.paginate(
      octokit.rest.codeScanning.listAlertsForRepo,
      {
        owner,
        repo,
        state: "open",
        per_page: 100, // Fetch up to 100 alerts per page
      },
    );

    // Fetch files changed in the PR. If it's a PR workflow we are going to use this to filter alerts
    const prNumber = github.context.payload.pull_request?.number;
    let prFiles: string[] = [];
    if (prNumber) {
      const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
        owner,
        repo,
        pull_number: prNumber,
      });
      prFiles = files.map((file) => file.filename);
      core.info(
        "This is a PR Check. The following files are not being validated as it might have fixes: " +
          prFiles.join(", "),
      );
    }

    // Group alerts by severity level dynamically
    const severityCounts: Record<string, number> = {};
    const breakingAlerts: string[] = []; // Array to store formatted alert details
    const nonBreakingAlerts: string[] = []; // Array to store formatted alert details
    const breakingAlertsPRFiles: string[] = []; // Array to store alert files that are part of the PR
    const nonBreakingAlertsPRFiles: string[] = []; // Array to store alert files that are part of the PR
    const disregardAlerts: number[] = []; // Array to store alert files that are part of the PR

    alerts.forEach((alert) => {
      const severity =
        alert.rule.security_severity_level || alert.rule.severity || "unknown";
      severityCounts[severity] = (severityCounts[severity] || 0) + 1;
    });
    alerts.forEach((alert) => {
      const severity =
        alert.rule.security_severity_level || alert.rule.severity || "unknown";
      // Check if the alert file is part of the PR
      const alertFile = alert.most_recent_instance.location?.path || ""; // || '' to avoid undefined, but is it necessary?
      const isFileInPR = prFiles.includes(alertFile);

      // Format each alert with severity, description, and link
      const formattedAlert = `**${severity.toUpperCase()}** - ${alert.rule.description} - [Details](${alert.html_url})`;

      if (
        !isNaN(maxAlertsThreshold[severity]) &&
        severityCounts[severity] > maxAlertsThreshold[severity] &&
        !isFileInPR
      ) {
        breakingAlerts.push(formattedAlert);
      } else if (!isFileInPR) {
        nonBreakingAlerts.push(formattedAlert);
      }
      if (
        !isNaN(maxAlertsThreshold[severity]) &&
        severityCounts[severity] > maxAlertsThreshold[severity] &&
        isFileInPR
      ) {
        breakingAlertsPRFiles.push(formattedAlert);
        disregardAlerts.push(alerts.indexOf(alert));
        severityCounts[severity] = severityCounts[severity] - 1;
      } else if (isFileInPR) {
        nonBreakingAlertsPRFiles.push(formattedAlert);
        disregardAlerts.push(alerts.indexOf(alert));
        severityCounts[severity] = severityCounts[severity] - 1;
      }
    });

    // Remove alerts that are part of the PR
    alerts = alerts.filter((_, index) => !disregardAlerts.includes(index));

    // Prepare output summary dynamically
    const summaryLines = Object.entries(severityCounts).map(
      ([severity, count]) =>
        `- ${severity.charAt(0).toUpperCase() + severity.slice(1)} Total Alerts: ${count}, Threshold: ${
          isNaN(maxAlertsThreshold[severity])
            ? "Notify only"
            : `Breaks when > ${maxAlertsThreshold[severity]}`
        }`,
    );

    // Prepare output summary
    const summaryTitleSuccess = `# 🟢 CodeScanning Alerts 🟢`;
    const summaryTitleFailure = `# 🚨 CodeScanning Alerts 🚨`;

    // BEGIN: Define helper variable for summary breakingMessage
    const breakingMessage =
      breakingAlerts.length > 0
        ? `
## Please address these issues before merging this PR:
${breakingAlerts.join("\n")}
        `
        : "";
    // END: Define helper variable for summary breakingMessage
    // BEGIN: Define helper variable for summary nonBreakingMessage
    const nonBreakingMessage =
      nonBreakingAlerts.length > 0
        ? `
## Please consider these issues for the upcoming service update:
${nonBreakingAlerts.join("\n")}
        `
        : "";
    // END: Define helper variable for summary nonBreakingMessage
    // BEGIN: Define helper variable for summary breakingMessagePRFiles
    const BreakingMessagePRFiles =
      breakingAlertsPRFiles.length > 0 || nonBreakingAlertsPRFiles.length > 0
        ? `
### The following alerts are for files that are part of this PR, because of this their status on main are not being validated, but take in consideration that if the fixes are not being done, the next release maybe blocked until solution:
${breakingAlertsPRFiles.join("\n")}
${nonBreakingAlertsPRFiles.join("\n")}
        `
        : "";
    //  END: Define helper variable for summary breakingMessagePRFiles

    // BEGIN: Define summary message
    const summary = `
${breakingAlerts.length > 0 ? summaryTitleFailure : summaryTitleSuccess}
## Summary
- Total Alerts: ${alerts.length}
${summaryLines.join("\n")}

${breakingMessage}

${nonBreakingMessage}

${BreakingMessagePRFiles}
        `;
    // END: Define summary message

    let conclusion: "failure" | "success";
    conclusion = "success";
    if (!prNumber || (prNumber && !doNotBreakPRCheck)) {
      ["critical", "high", "medium", "low", "note"].forEach((severity) => {
        if (severityCounts[severity] > maxAlertsThreshold[severity]) {
          conclusion = "failure";
          return;
        }
      });
    }

    // Comment logic
    if (prNumber) {
        const commentIdentifier = "<!-- Code Scanning Alerts Comment -->"; // Unique identifier
        const maxCommentLength = 65530; // Maximum comment length

        let body = `${commentIdentifier}\n${summary}`;

        // Check if comment exceeds the maximum length
        if (body.length > maxCommentLength) {
            const truncatedMessage = `\n**Truncated:** [Go to CodeScanning](https://github.com/${owner}/${repo}/security/code-scanning).`;
            // Truncate the body and add the see more details link
            body = `${commentIdentifier}\n${body.slice(0, maxCommentLength - truncatedMessage.length - commentIdentifier.length)}...\n${truncatedMessage}`;
        }

        // Get all PR Comments
        const { data: comments } = await octokit.rest.issues.listComments({
            owner,
            repo,
            issue_number: prNumber,
        });

        // Procura por um comentário existente criado por esta Action
        const existingComment = comments.find((comment) =>
            comment.body?.startsWith(commentIdentifier)
        );

        if (existingComment) {
            // Updates the existing comment
            await octokit.rest.issues.updateComment({
                owner,
                repo,
                comment_id: existingComment.id,
                body: `${body}`,
            });
            core.info(`Updated existing comment (ID: ${existingComment.id}) on PR #${prNumber}`);
        } else {
            // Creates a new comment
            await octokit.rest.issues.createComment({
                owner,
                repo,
                issue_number: prNumber,
                body: `${body}`,
            });
            core.info(`Created a new comment on PR #${prNumber}`);   
        }
    }
    else {
      core.info('No PR number found. Skipping comment creation.');
    }

    // Set outputs for the action
    core.setOutput("total_alerts", alerts.length);
    ["critical", "high", "medium", "low", "note"].forEach((severity) => {
      core.setOutput(`${severity}_alerts`, severityCounts[severity] || 0);
      core.setOutput(
        `${severity}_alerts_threshold`,
        isNaN(maxAlertsThreshold[severity]) ? -1 : maxAlertsThreshold[severity],
      );
    });

    core.info(`summary: ${summary}`);
    core.setOutput("conclusion", conclusion);

    if (conclusion == "success") {
      core.info("Code Scanning Alerts threshold not exceeded");
    }
    else {
      core.setFailed("Code scanning alerts exceed the allowed thresholds");
    }

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(String(error));
    }
  }
}
