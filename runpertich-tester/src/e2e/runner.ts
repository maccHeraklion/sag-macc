import type { TestResult, TestSuiteResult } from "../types";

export interface TestCase {
  name: string;
  description: string;
  run: (code: string) => Promise<{ passed: boolean; message: string }>;
}

export async function runSuite(
  code: string,
  tests: TestCase[]
): Promise<TestSuiteResult> {
  const suiteStart = performance.now();
  const results: TestResult[] = [];

  for (const test of tests) {
    const start = performance.now();
    let passed = false;
    let message = "";

    try {
      const outcome = await test.run(code);
      passed = outcome.passed;
      message = outcome.message;
    } catch (err) {
      passed = false;
      message = err instanceof Error ? err.message : String(err);
    }

    results.push({
      name: test.name,
      description: test.description,
      passed,
      message,
      durationMs: Math.round(performance.now() - start),
    });
  }

  const passed = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
    durationMs: Math.round(performance.now() - suiteStart),
  };
}
