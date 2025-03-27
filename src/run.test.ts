import * as core from "@actions/core";
import * as github from "@actions/github";
import { run } from "./run";

jest.mock("@actions/core");
jest.mock("@actions/github");

describe("run", () => {
  const mockGetInput = core.getInput as jest.MockedFunction<
    typeof core.getInput
  >;
  const mockSetOutput = core.setOutput as jest.MockedFunction<
    typeof core.setOutput
  >;
  const mockSetFailed = core.setFailed as jest.MockedFunction<
    typeof core.setFailed
  >;
  //   const mockInfo = core.info as jest.MockedFunction<typeof core.info>;
  const mockGetOctokit = github.getOctokit as jest.MockedFunction<
    typeof github.getOctokit
  >;

  let mockOctokit: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOctokit = {
      paginate: jest.fn(),
      rest: {
        codeScanning: {
          listAlertsForRepo: jest.fn(),
        },
        pulls: {
          listFiles: jest.fn(),
        },
        issues: {
          listComments: jest.fn(), // Adiciona o mock para listComments
          createComment: jest.fn(), // Adiciona o mock para createComment
          updateComment: jest.fn(), // Adiciona o mock para updateComment
        },
      },
    };

    mockGetOctokit.mockReturnValue(mockOctokit);
  });

  it("should handle no alerts and succeed", async () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        github_token: "fake-token",
        owner: "test-owner",
        repo: "test-repo",
        sha: "test-sha",
        do_not_break_pr_check: "false",
        max_critical_alerts: "0",
        max_high_alerts: "0",
        max_medium_alerts: "0",
        max_low_alerts: "0",
        max_note_alerts: "0",
      };
      return inputs[name];
    });

    mockOctokit.paginate.mockResolvedValueOnce([]); // No alerts

    await run();
    // console.log("Mock calls:", mockSetOutput.mock.calls);
    expect(mockSetOutput).toHaveBeenCalledWith("total_alerts", 0);
    expect(mockSetOutput).toHaveBeenCalledWith("critical_alerts", 0);
    expect(mockSetOutput).toHaveBeenCalledWith("high_alerts", 0);
    expect(mockSetOutput).toHaveBeenCalledWith("medium_alerts", 0);
    expect(mockSetOutput).toHaveBeenCalledWith("low_alerts", 0);
    expect(mockSetOutput).toHaveBeenCalledWith("note_alerts", 0);
    expect(mockSetOutput).toHaveBeenCalledWith("critical_alerts_threshold", 0);
    expect(mockSetOutput).toHaveBeenCalledWith("high_alerts_threshold", 0);
    expect(mockSetOutput).toHaveBeenCalledWith("medium_alerts_threshold", 0);
    expect(mockSetOutput).toHaveBeenCalledWith("low_alerts_threshold", 0);
    expect(mockSetOutput).toHaveBeenCalledWith("note_alerts_threshold", 0);
    expect(mockSetOutput).toHaveBeenCalledWith("conclusion", "success");
  });

  it("should fail when alerts exceed thresholds", async () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        github_token: "fake-token",
        owner: "test-owner",
        repo: "test-repo",
        sha: "test-sha",
        do_not_break_pr_check: "false",
        max_critical_alerts: "0",
        max_high_alerts: "0",
        max_medium_alerts: "0",
        max_low_alerts: "0",
        max_note_alerts: "0",
      };
      return inputs[name];
    });

    mockOctokit.paginate.mockResolvedValueOnce([
      {
        rule: {
          security_severity_level: "critical",
          description: "Critical issue",
        },
        html_url: "http://example.com/1",
        most_recent_instance: { location: { path: "file3.js" } },
      },
    ]); // One critical alert

    await run();

    expect(mockSetOutput).toHaveBeenCalledWith("total_alerts", 1);
    expect(mockSetOutput).toHaveBeenCalledWith("critical_alerts", 1);
    expect(mockSetOutput).toHaveBeenCalledWith("critical_alerts_threshold", 0);
    expect(mockSetOutput).toHaveBeenCalledWith("conclusion", "failure");
    expect(mockSetFailed).toHaveBeenCalledWith(
      "Code scanning alerts exceed the allowed thresholds"
    );
  });

  it("should not fail when have alerts but not exceed thresholds", async () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        github_token: "fake-token",
        owner: "test-owner",
        repo: "test-repo",
        sha: "test-sha",
        do_not_break_pr_check: "false",
        max_critical_alerts: "10",
        max_high_alerts: "10",
        max_medium_alerts: "10",
        max_low_alerts: "10",
        max_note_alerts: "10",
      };
      return inputs[name];
    });

    mockOctokit.paginate.mockResolvedValueOnce([
      {
        rule: {
          security_severity_level: "critical",
          description: "Critical issue",
        },
        html_url: "http://example.com/1",
        most_recent_instance: { location: { path: "file7.js" } },
      },
    ]); // One critical alert

    await run();
    // console.log("Mock calls:", mockSetOutput.mock.calls);

    expect(mockSetOutput).toHaveBeenCalledWith("total_alerts", 1);
    expect(mockSetOutput).toHaveBeenCalledWith("critical_alerts", 1);
    expect(mockSetOutput).toHaveBeenCalledWith("critical_alerts_threshold", 10);
    expect(mockSetOutput).toHaveBeenCalledWith("conclusion", "success");
  });

  it("should handle PR-specific alerts and not fail due do_not_break_pr_checks", async () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        github_token: "fake-token",
        owner: "test-owner",
        repo: "test-repo",
        sha: "test-sha",
        do_not_break_pr_check: "true",
        max_critical_alerts: "0",
        max_high_alerts: "0",
        max_medium_alerts: "0",
        max_low_alerts: "0",
        max_note_alerts: "0",
      };
      return inputs[name];
    });

    github.context.payload = {
      pull_request: {
        number: 123,
      },
    };

    mockOctokit.rest.issues.listComments.mockImplementation(
      ({ owner, repo, issue_number }: { owner: string; repo: string; issue_number: number }) => {
        if (owner === "test-owner" && repo === "test-repo" && issue_number === 123) {
          return Promise.resolve({
            data: [
              {
                id: 1,
                body: "<!-- Code Scanning Alerts Comment -->\nExisting comment body",
              },
            ],
          });
        }
        return Promise.resolve({ data: [] });
      }
    );
    
    mockOctokit.rest.issues.createComment.mockImplementation(
      ({ owner, repo, issue_number, body }: { owner: string; repo: string; issue_number: number; body: string }) => {
        if (owner === "test-owner" && repo === "test-repo" && issue_number === 123) {
          return Promise.resolve({
            data: {
              id: 2,
              body,
            },
          });
        }
        return Promise.reject(new Error("Failed to create comment"));
      }
    );
    
    mockOctokit.rest.issues.updateComment.mockImplementation(
      ({ owner, repo, comment_id, body }: { owner: string; repo: string; comment_id: number; body: string }) => {
        if (owner === "test-owner" && repo === "test-repo" && comment_id === 1) {
          return Promise.resolve({
            data: {
              id: 1,
              body,
            },
          });
        }
        return Promise.reject(new Error("Failed to update comment"));
      }
    )

    mockOctokit.paginate.mockImplementation((fn: any) => {
      if (fn === mockOctokit.rest.pulls.listFiles) {
        // Retorna os arquivos do PR
        return Promise.resolve([{ filename: "file4.js" }]);
      } else if (fn === mockOctokit.rest.codeScanning.listAlertsForRepo) {
        // Retorna os alertas de segurança
        return Promise.resolve([
          {
            rule: {
              security_severity_level: "critical",
              description: "Critical issue",
            },
            html_url: "http://example.com/1",
            most_recent_instance: { location: { path: "file5.js" } },
          },
        ]);
      }
      return Promise.resolve([]);
    });

    await run();
    console.log("Mock calls:", mockSetOutput.mock.calls);
    expect(mockSetOutput).toHaveBeenCalledWith("total_alerts", 1);
    expect(mockSetOutput).toHaveBeenCalledWith("critical_alerts", 1);
    expect(mockSetOutput).toHaveBeenCalledWith("conclusion", "success");
  });

  it("should handle PR-specific alerts and fail", async () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        github_token: "fake-token",
        owner: "test-owner",
        repo: "test-repo",
        sha: "test-sha",
        do_not_break_pr_check: "false",
        max_critical_alerts: "0",
        max_high_alerts: "0",
        max_medium_alerts: "0",
        max_low_alerts: "0",
        max_note_alerts: "0",
      };
      return inputs[name];
    });

    github.context.payload = {
      pull_request: {
        number: 123,
      },
    };

    mockOctokit.rest.issues.listComments.mockImplementation(
      ({ owner, repo, issue_number }: { owner: string; repo: string; issue_number: number }) => {
        if (owner === "test-owner" && repo === "test-repo" && issue_number === 123) {
          return Promise.resolve({
            data: [
              {
                id: 1,
                body: "<!-- Code Scanning Alerts Comment -->\nExisting comment body",
              },
            ],
          });
        }
        return Promise.resolve({ data: [] });
      }
    );
    
    mockOctokit.rest.issues.createComment.mockImplementation(
      ({ owner, repo, issue_number, body }: { owner: string; repo: string; issue_number: number; body: string }) => {
        if (owner === "test-owner" && repo === "test-repo" && issue_number === 123) {
          return Promise.resolve({
            data: {
              id: 2,
              body,
            },
          });
        }
        return Promise.reject(new Error("Failed to create comment"));
      }
    );
    
    mockOctokit.rest.issues.updateComment.mockImplementation(
      ({ owner, repo, comment_id, body }: { owner: string; repo: string; comment_id: number; body: string }) => {
        if (owner === "test-owner" && repo === "test-repo" && comment_id === 1) {
          return Promise.resolve({
            data: {
              id: 1,
              body,
            },
          });
        }
        return Promise.reject(new Error("Failed to update comment"));
      }
    )

    mockOctokit.paginate.mockImplementation((fn: any) => {
      if (fn === mockOctokit.rest.pulls.listFiles) {
        // Retorna os arquivos do PR
        return Promise.resolve([{ filename: "file2.js" }]);
      } else if (fn === mockOctokit.rest.codeScanning.listAlertsForRepo) {
        // Retorna os alertas de segurança
        return Promise.resolve([
          {
            rule: {
              security_severity_level: "critical",
              description: "Critical issue",
            },
            html_url: "http://example.com/1",
            most_recent_instance: { location: { path: "file6.js" } },
          },
        ]);
      }
      return Promise.resolve([]);
    });

    await run();
    // console.log("Mock calls:", mockSetOutput.mock.calls);
    expect(mockSetOutput).toHaveBeenCalledWith("total_alerts", 1);
    expect(mockSetOutput).toHaveBeenCalledWith("critical_alerts", 1);
    expect(mockSetOutput).toHaveBeenCalledWith("conclusion", "failure");
    expect(mockSetFailed).toHaveBeenCalledWith(
      "Code scanning alerts exceed the allowed thresholds"
    );
  });

  it("should handle PR-specific alerts and not fail due file in PR is PR with alert", async () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        github_token: "fake-token",
        owner: "test-owner",
        repo: "test-repo",
        sha: "test-sha",
        do_not_break_pr_check: "false",
        max_critical_alerts: "0",
        max_high_alerts: "0",
        max_medium_alerts: "0",
        max_low_alerts: "0",
        max_note_alerts: "0",
      };
      return inputs[name];
    });

    github.context.payload = {
      pull_request: {
        number: 123,
      },
    };

    mockOctokit.rest.issues.listComments.mockImplementation(
      ({ owner, repo, issue_number }: { owner: string; repo: string; issue_number: number }) => {
        if (owner === "test-owner" && repo === "test-repo" && issue_number === 123) {
          return Promise.resolve({
            data: [
              {
                id: 1,
                body: "<!-- Code Scanning Alerts Comment -->\nExisting comment body",
              },
            ],
          });
        }
        return Promise.resolve({ data: [] });
      }
    );
    
    mockOctokit.rest.issues.createComment.mockImplementation(
      ({ owner, repo, issue_number, body }: { owner: string; repo: string; issue_number: number; body: string }) => {
        if (owner === "test-owner" && repo === "test-repo" && issue_number === 123) {
          return Promise.resolve({
            data: {
              id: 2,
              body,
            },
          });
        }
        return Promise.reject(new Error("Failed to create comment"));
      }
    );
    
    mockOctokit.rest.issues.updateComment.mockImplementation(
      ({ owner, repo, comment_id, body }: { owner: string; repo: string; comment_id: number; body: string }) => {
        if (owner === "test-owner" && repo === "test-repo" && comment_id === 1) {
          return Promise.resolve({
            data: {
              id: 1,
              body,
            },
          });
        }
        return Promise.reject(new Error("Failed to update comment"));
      }
    )

    mockOctokit.paginate.mockImplementation((fn: any) => {
      if (fn === mockOctokit.rest.pulls.listFiles) {
        // Retorna os arquivos do PR
        return Promise.resolve([
          { filename: "file1.js" },
          { filename: "file2.js" },
        ]);
      } else if (fn === mockOctokit.rest.codeScanning.listAlertsForRepo) {
        // Retorna os alertas de segurança
        return Promise.resolve([
          {
            rule: {
              security_severity_level: "critical",
              description: "Critical issue",
            },
            html_url: "http://example.com/1",
            most_recent_instance: { location: { path: "file1.js" } },
          },
          {
            rule: {
              security_severity_level: "high",
              description: "High issue",
            },
            html_url: "http://example.com/2",
            most_recent_instance: { location: { path: "file2.js" } },
          },
        ]);
      }
      return Promise.resolve([]);
    });

    await run();
    // console.log("Mock calls:", mockSetOutput.mock.calls);
    expect(mockSetOutput).toHaveBeenCalledWith("total_alerts", 0);
    expect(mockSetOutput).toHaveBeenCalledWith("critical_alerts", 0);
    expect(mockSetOutput).toHaveBeenCalledWith("conclusion", "success");
  });

  it("should handle PR-specific alerts and fail because not all PR files are in the alert list", async () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        github_token: "fake-token",
        owner: "test-owner",
        repo: "test-repo",
        sha: "test-sha",
        do_not_break_pr_check: "false",
        max_critical_alerts: "0",
        max_high_alerts: "0",
        max_medium_alerts: "0",
        max_low_alerts: "0",
        max_note_alerts: "0",
      };
      return inputs[name];
    });

    github.context.payload = {
      pull_request: {
        number: 123,
      },
    };

    mockOctokit.rest.issues.listComments.mockImplementation(
      ({ owner, repo, issue_number }: { owner: string; repo: string; issue_number: number }) => {
        if (owner === "test-owner" && repo === "test-repo" && issue_number === 123) {
          return Promise.resolve({
            data: [
              {
                id: 1,
                body: "<!-- Code Scanning Alerts Comment -->\nExisting comment body",
              },
            ],
          });
        }
        return Promise.resolve({ data: [] });
      }
    );
    
    mockOctokit.rest.issues.createComment.mockImplementation(
      ({ owner, repo, issue_number, body }: { owner: string; repo: string; issue_number: number; body: string }) => {
        if (owner === "test-owner" && repo === "test-repo" && issue_number === 123) {
          return Promise.resolve({
            data: {
              id: 2,
              body,
            },
          });
        }
        return Promise.reject(new Error("Failed to create comment"));
      }
    );
    
    mockOctokit.rest.issues.updateComment.mockImplementation(
      ({ owner, repo, comment_id, body }: { owner: string; repo: string; comment_id: number; body: string }) => {
        if (owner === "test-owner" && repo === "test-repo" && comment_id === 1) {
          return Promise.resolve({
            data: {
              id: 1,
              body,
            },
          });
        }
        return Promise.reject(new Error("Failed to update comment"));
      }
    )

    mockOctokit.paginate.mockImplementation((fn: any) => {
      if (fn === mockOctokit.rest.pulls.listFiles) {
        // Retorna os arquivos do PR
        return Promise.resolve([{ filename: "file1.js" }]);
      } else if (fn === mockOctokit.rest.codeScanning.listAlertsForRepo) {
        // Retorna os alertas de segurança
        return Promise.resolve([
          {
            rule: {
              security_severity_level: "critical",
              description: "Critical issue",
            },
            html_url: "http://example.com/1",
            most_recent_instance: { location: { path: "file1.js" } },
          },
          {
            rule: {
              security_severity_level: "critical",
              description: "Critical issue 2",
            },
            html_url: "http://example.com/2",
            most_recent_instance: { location: { path: "file2.js" } },
          },
        ]);
      }
      return Promise.resolve([]);
    });

    await run();
    // console.log("Mock calls:", mockSetOutput.mock.calls);
    expect(mockSetOutput).toHaveBeenCalledWith("total_alerts", 1);
    expect(mockSetOutput).toHaveBeenCalledWith("critical_alerts", 1);
    expect(mockSetOutput).toHaveBeenCalledWith("conclusion", "failure");
    expect(mockSetFailed).toHaveBeenCalledWith(
      "Code scanning alerts exceed the allowed thresholds"
    );
  });

  it("should handle PR-specific alerts and not fail due do_not_break_pr_checks, creating new comment", async () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        github_token: "fake-token",
        owner: "test-owner",
        repo: "test-repo",
        sha: "test-sha",
        do_not_break_pr_check: "true",
        max_critical_alerts: "0",
        max_high_alerts: "0",
        max_medium_alerts: "0",
        max_low_alerts: "0",
        max_note_alerts: "0",
      };
      return inputs[name];
    });

    github.context.payload = {
      pull_request: {
        number: 123,
      },
    };

    mockOctokit.rest.issues.listComments.mockImplementation(
      ({ owner, repo, issue_number }: { owner: string; repo: string; issue_number: number }) => {
        if (owner === "test-owner" && repo === "test-repo" && issue_number === 123) {
          return Promise.resolve({
            data: [],
          });
        }
        return Promise.resolve({ data: [] });
      }
    );
    
    mockOctokit.rest.issues.createComment.mockImplementation(
      ({ owner, repo, issue_number, body }: { owner: string; repo: string; issue_number: number; body: string }) => {
        if (owner === "test-owner" && repo === "test-repo" && issue_number === 123) {
          return Promise.resolve({
            data: {
              id: 2,
              body,
            },
          });
        }
        return Promise.reject(new Error("Failed to create comment"));
      }
    );
    
    mockOctokit.rest.issues.updateComment.mockImplementation(
      ({ owner, repo, comment_id, body }: { owner: string; repo: string; comment_id: number; body: string }) => {
        if (owner === "test-owner" && repo === "test-repo" && comment_id === 1) {
          return Promise.resolve({
            data: {
              id: 1,
              body,
            },
          });
        }
        return Promise.reject(new Error("Failed to update comment"));
      }
    )

    mockOctokit.paginate.mockImplementation((fn: any) => {
      if (fn === mockOctokit.rest.pulls.listFiles) {
        // Retorna os arquivos do PR
        return Promise.resolve([{ filename: "file4.js" }]);
      } else if (fn === mockOctokit.rest.codeScanning.listAlertsForRepo) {
        // Retorna os alertas de segurança
        return Promise.resolve([
          {
            rule: {
              security_severity_level: "critical",
              description: "Critical issue",
            },
            html_url: "http://example.com/1",
            most_recent_instance: { location: { path: "file5.js" } },
          },
        ]);
      }
      return Promise.resolve([]);
    });

    await run();
    console.log("Mock calls:", mockSetOutput.mock.calls);
    expect(mockSetOutput).toHaveBeenCalledWith("total_alerts", 1);
    expect(mockSetOutput).toHaveBeenCalledWith("critical_alerts", 1);
    expect(mockSetOutput).toHaveBeenCalledWith("conclusion", "success");
  });

  it("should handle errors gracefully", async () => {
    const errorMessage = "Something went wrong";
    mockGetInput.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await run();

    expect(mockSetFailed).toHaveBeenCalledWith(errorMessage);
  });
});
