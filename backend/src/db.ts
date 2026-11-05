import pg from 'pg';
import type { Role } from './authorisation.js';

export interface Membership { organisation_id: string; subject: string; role: Role }
export interface IdentityStore {
  membership(organisationId: string, subject: string): Promise<Membership | null>;
  organisation(organisationId: string): Promise<{ id: string; name: string } | null>;
  listOrganisations(subject: string): Promise<Array<{id: string; name: string; role: Role}>>;
  close(): Promise<void>;
}
export class PostgresIdentityStore implements IdentityStore {
  private pool: pg.Pool;
  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 3000, idleTimeoutMillis: 15000 });
  }
  async membership(organisationId: string, subject: string): Promise<Membership | null> {
    const result = await this.pool.query<Membership>(
      'SELECT organisation_id, subject, role FROM memberships WHERE organisation_id = $1 AND subject = $2 AND status = $3',
      [organisationId, subject, 'active']);
    return result.rows[0] ?? null;
  }
  async organisation(organisationId: string) {
    const result = await this.pool.query<{id: string;name:string}>('SELECT id, name FROM organisations WHERE id = $1', [organisationId]);
    return result.rows[0] ?? null;
  }
  async listOrganisations(subject: string) {
    const result = await this.pool.query<{id:string;name:string;role:Role}>(
      'SELECT o.id, o.name, m.role FROM organisations o INNER JOIN memberships m ON m.organisation_id = o.id WHERE m.subject = $1 AND m.status = $2 ORDER BY o.name',
      [subject, 'active']);
    return result.rows;
  }
  async close() { await this.pool.end(); }
}
