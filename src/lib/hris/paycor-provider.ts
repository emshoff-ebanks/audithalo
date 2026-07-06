import type { PaycorEmployee, PaycorEmploymentStatus } from "./types";

export type PaycorEmployeeStatus = {
  employeeId: string;
  status: PaycorEmploymentStatus;
  leaveStartDate: Date | null;
  leaveReason: string | null;
};

export interface PaycorProvider {
  fetchEmployees(legalEntityId: string): Promise<PaycorEmployee[]>;
  fetchEmployeeStatus(employeeId: string): Promise<PaycorEmployeeStatus>;
}

/**
 * Mock provider for testing and development. Returns configurable test data.
 * Swap for the real provider (Phase 3) when Paycor credentials arrive.
 */
export class MockPaycorProvider implements PaycorProvider {
  private employees = new Map<string, PaycorEmployee[]>();
  private statuses = new Map<string, PaycorEmployeeStatus>();

  setEmployees(legalEntityId: string, employees: PaycorEmployee[]): void {
    this.employees.set(legalEntityId, employees);
  }

  setStatus(employeeId: string, status: PaycorEmployeeStatus): void {
    this.statuses.set(employeeId, status);
  }

  async fetchEmployees(legalEntityId: string): Promise<PaycorEmployee[]> {
    return this.employees.get(legalEntityId) ?? [];
  }

  async fetchEmployeeStatus(employeeId: string): Promise<PaycorEmployeeStatus> {
    const status = this.statuses.get(employeeId);
    if (!status)
      throw new Error(
        `Mock: no status configured for employee ${employeeId}`,
      );
    return status;
  }
}
