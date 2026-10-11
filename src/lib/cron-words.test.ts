import { describe, expect, it } from "vitest";
import { scheduleInWords } from "./cron-words";

describe("scheduleInWords", () => {
  it("passes words through, capitalized", () => {
    expect(scheduleInWords("every night at 10pm")).toBe("Every night at 10pm");
    expect(scheduleInWords(null)).toBe("No schedule");
    expect(scheduleInWords("  ")).toBe("No schedule");
  });
  it("reads common cron shapes", () => {
    expect(scheduleInWords("0 22 * * *")).toBe("Daily at 10pm");
    expect(scheduleInWords("30 9 * * 1-5")).toBe("Weekdays at 9:30am");
    expect(scheduleInWords("0 9 * * 0,6")).toBe("Weekends at 9am");
    expect(scheduleInWords("0 13 * * 0")).toBe("Sundays at 1pm");
    expect(scheduleInWords("0 8 * * 1,3,5")).toBe("Mondays, Wednesdays and Fridays at 8am");
    expect(scheduleInWords("0 8,20 * * *")).toBe("Daily at 8am and 8pm");
    expect(scheduleInWords("*/15 * * * *")).toBe("Every 15 minutes");
    expect(scheduleInWords("5 * * * *")).toBe("Hourly at :05");
    expect(scheduleInWords("0 */3 * * *")).toBe("Every 3 hours");
    expect(scheduleInWords("0 9 1 * *")).toBe("Monthly on the 1st at 9am");
  });
  it("leaves unusual cron alone", () => {
    expect(scheduleInWords("0 9 * 1 *")).toBe("0 9 * 1 *");
    expect(scheduleInWords("0 9 * * 9")).toBe("0 9 * * 9");
  });
});
