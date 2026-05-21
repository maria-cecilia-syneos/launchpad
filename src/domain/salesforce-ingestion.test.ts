import { describe, expect, it } from "vitest";

import {
  buildSalesforceLaunchContextIngestionResult,
  canIngestSalesforceSource,
  getSalesforceIngestionResultMessage,
  runPrototypeSalesforceIngestion,
  type SalesforceAdapterRecord,
  type SalesforceFieldMapping,
} from "./salesforce-ingestion";
import {
  buildSourceRegistrationRecord,
  createPrototypeSourceRecords,
} from "./source-ledger";

const salesforceSource = buildSourceRegistrationRecord(
  {
    accessState: "authorized",
    approvalState: "approved",
    freshnessState: "watch",
    ingestionStatus: "ready",
    objectId: "006CARDIOMAX",
    owningTeam: "Sales Operations",
    sourceName: "CARDIOMAX Salesforce Launch Context",
    sourceSystem: "ecrm_salesforce",
    sourceType: "salesforce_record",
    sourceUrl: "https://example.my.salesforce.com/lightning/r/Opportunity/006CARDIOMAX/view",
  },
  {
    registeredAt: "2026-05-21T14:20:00.000Z",
    sourceId: "src-cardiomax-salesforce-context",
  },
);

const fieldMapping: SalesforceFieldMapping = {
  accountClientLabel: "Client_Label__c",
  commercialContext: ["Permitted_Commercial_Context__c", "Restricted_Deal_Notes__c"],
  launchId: "Launch_Id__c",
  opportunityOrEngagementId: "Opportunity_Number__c",
  sourceUrl: "Record_Url__c",
  stakeholderNamesOrRoles: ["Executive_Sponsor__c", "Restricted_Stakeholder__c"],
};

const adapterRecord: SalesforceAdapterRecord = {
  accessState: "authorized",
  fieldMapping,
  fieldValues: {
    Client_Label__c: "CARDIOMAX",
    Executive_Sponsor__c: "Regional VP sponsor",
    Launch_Id__c: "launch-cardiomax-2026",
    Opportunity_Number__c: "OPP-4242",
    Permitted_Commercial_Context__c: "Phase 2 expansion is in contracting.",
    Record_Url__c:
      "https://example.my.salesforce.com/lightning/r/Opportunity/006CARDIOMAX/view",
    Restricted_Deal_Notes__c: "Do not expose restricted pricing notes.",
    Restricted_Stakeholder__c: "Hidden stakeholder name",
    rawPayloadEcho: "raw Salesforce payload should not be stored",
  },
  lastModifiedAt: "2026-05-21T14:30:00.000Z",
  objectApiName: "Opportunity",
  objectId: "006CARDIOMAX",
  permittedFieldNames: [
    "Client_Label__c",
    "Executive_Sponsor__c",
    "Launch_Id__c",
    "Opportunity_Number__c",
    "Permitted_Commercial_Context__c",
    "Record_Url__c",
  ],
  sourceUrl:
    "https://example.my.salesforce.com/lightning/r/Opportunity/006CARDIOMAX/view",
};

describe("salesforce ingestion domain helpers", () => {
  it("allows only approved, authorized Salesforce source records", () => {
    const prototypeSources = createPrototypeSourceRecords();
    const sharePointSource = prototypeSources.find(
      (source) => source.sourceSystem === "sharepoint",
    );
    const restrictedSource = prototypeSources.find(
      (source) => source.accessState === "restricted",
    );

    expect(canIngestSalesforceSource(salesforceSource)).toBe(true);
    expect(canIngestSalesforceSource(sharePointSource!)).toBe(false);
    expect(canIngestSalesforceSource(restrictedSource!)).toBe(false);
  });

  it("normalizes mapped launch context without raw Salesforce payloads or tokens", () => {
    const result = buildSalesforceLaunchContextIngestionResult({
      actorId: "Admin Reviewer",
      correlationId: "corr-salesforce-sync-1",
      occurredAt: "2026-05-21T14:35:00.000Z",
      record: {
        ...adapterRecord,
        bearerToken: "never-render",
        rawSalesforcePayload: {
          attributes: { type: "Opportunity" },
          Restricted_Deal_Notes__c: "raw restricted pricing notes",
        },
      } as SalesforceAdapterRecord,
      source: salesforceSource,
    });

    expect(result.syncStatus).toBe("completed");
    expect(result.updatedSource).toMatchObject({
      accessState: "authorized",
      approvalState: "approved",
      freshnessState: "fresh",
      ingestionStatus: "complete",
      lastRefreshedAt: "2026-05-21T14:30:00.000Z",
      objectId: "006CARDIOMAX",
      sourceId: "src-cardiomax-salesforce-context",
      sourceName: "CARDIOMAX Salesforce Context",
      sourceSystem: "ecrm_salesforce",
    });
    expect(result.launchContextRecords).toHaveLength(1);
    expect(result.launchContextRecords[0]).toMatchObject({
      accountClientLabel: "CARDIOMAX",
      commercialContext: ["Phase 2 expansion is in contracting."],
      accessState: "authorized",
      approvalState: "approved",
      freshnessState: "fresh",
      launchId: "launch-cardiomax-2026",
      opportunityOrEngagementId: "OPP-4242",
      refreshedAt: "2026-05-21T14:30:00.000Z",
      sourceId: "src-cardiomax-salesforce-context",
      sourceLocationKey: "006CARDIOMAX",
      sourceObjectId: "006CARDIOMAX",
      sourceSystem: "ecrm_salesforce",
      stakeholderNamesOrRoles: ["Regional VP sponsor"],
    });
    expect(result.auditEvent).toMatchObject({
      actorId: "Admin Reviewer",
      correlationId: "corr-salesforce-sync-1",
      eventType: "source.sync_completed",
      metadata: {
        contextRecordCount: 1,
        freshnessState: "fresh",
        ingestionStatus: "complete",
        sourceId: "src-cardiomax-salesforce-context",
        sourceSystem: "ecrm_salesforce",
        syncStatus: "completed",
      },
      occurredAt: "2026-05-21T14:35:00.000Z",
      sourceSystem: "ecrm_salesforce",
    });
    expect(JSON.stringify(result)).not.toContain("bearerToken");
    expect(JSON.stringify(result)).not.toContain("rawSalesforcePayload");
    expect(JSON.stringify(result)).not.toContain("raw Salesforce payload");
    expect(JSON.stringify(result)).not.toContain("restricted pricing");
    expect(JSON.stringify(result)).not.toContain("Hidden stakeholder");
  });

  it("returns access_restricted without confirming restricted Salesforce details", () => {
    const result = buildSalesforceLaunchContextIngestionResult({
      actorId: "Admin Reviewer",
      record: {
        ...adapterRecord,
        accessState: "restricted",
        fieldValues: {
          ...adapterRecord.fieldValues,
          Client_Label__c: "Restricted oncology client",
        },
      },
      source: salesforceSource,
    });

    expect(result).toMatchObject({
      launchContextRecords: [],
      reasonState: "access_restricted",
      syncStatus: "skipped",
      updatedSource: {
        accessState: "restricted",
        freshnessState: "restricted",
        ingestionStatus: "restricted",
      },
      userSafeReason:
        "Access restricted. Salesforce launch context is not available for this user or role.",
    });
    expect(result.auditEvent).toMatchObject({
      eventType: "source.sync_skipped",
      metadata: {
        reasonState: "access_restricted",
        syncStatus: "skipped",
      },
    });
    expect(JSON.stringify(result)).not.toContain("oncology client");
  });

  it("treats malformed or non-authorized adapter access as restricted", () => {
    const result = buildSalesforceLaunchContextIngestionResult({
      actorId: "Admin Reviewer",
      record: {
        ...adapterRecord,
        accessState: "denied",
      } as unknown as SalesforceAdapterRecord,
      source: salesforceSource,
    });

    expect(result).toMatchObject({
      launchContextRecords: [],
      reasonState: "access_restricted",
      syncStatus: "skipped",
      updatedSource: {
        accessState: "restricted",
        freshnessState: "restricted",
        ingestionStatus: "restricted",
      },
    });
  });

  it("maps connector failures to a user-safe failed state", () => {
    const result = runPrototypeSalesforceIngestion({
      actorId: "Admin Reviewer",
      source: {
        ...salesforceSource,
        objectId: "connector-failure-salesforce-record",
      },
    });

    expect(result).toMatchObject({
      launchContextRecords: [],
      reasonState: "connector_unavailable",
      syncStatus: "failed",
      updatedSource: {
        freshnessState: "stale",
        ingestionStatus: "failed",
      },
      userSafeReason:
        "Salesforce launch context could not be retrieved. Check connector availability and source access.",
    });
    expect(result.auditEvent).toMatchObject({
      eventType: "source.sync_failed",
      metadata: {
        reasonState: "connector_unavailable",
        syncStatus: "failed",
      },
    });
  });

  it("requires source provenance, mapped launch association, and retrieval fields", () => {
    expect(
      canIngestSalesforceSource({
        ...salesforceSource,
        objectId: undefined,
        sourceUrl: undefined,
      }),
    ).toBe(false);

    const result = buildSalesforceLaunchContextIngestionResult({
      record: {
        ...adapterRecord,
        fieldValues: {
          Client_Label__c: "CARDIOMAX",
          Opportunity_Number__c: "OPP-4242",
        },
      },
      source: salesforceSource,
      systemActor: "source-sync-service",
    });

    expect(result).toMatchObject({
      launchContextRecords: [],
      reasonState: "missing_information",
      syncStatus: "skipped",
      updatedSource: {
        freshnessState: "watch",
        ingestionStatus: "incomplete",
      },
      userSafeReason:
        "Salesforce launch context is missing required mapped launch fields.",
    });
    expect(result.auditEvent).toMatchObject({
      eventType: "source.sync_skipped",
      metadata: {
        reasonState: "missing_information",
        sourceSystem: "ecrm_salesforce",
        syncStatus: "skipped",
      },
      systemActor: "source-sync-service",
    });
  });

  it("rejects adapter records that do not match the registered source", () => {
    const result = buildSalesforceLaunchContextIngestionResult({
      actorId: "Admin Reviewer",
      record: {
        ...adapterRecord,
        objectId: "006DIFFERENT",
      },
      source: salesforceSource,
    });

    expect(result).toMatchObject({
      launchContextRecords: [],
      reasonState: "missing_information",
      syncStatus: "skipped",
      updatedSource: {
        freshnessState: "watch",
        ingestionStatus: "incomplete",
      },
    });
  });

  it("does not persist unsafe Salesforce source URLs", () => {
    const result = buildSalesforceLaunchContextIngestionResult({
      actorId: "Admin Reviewer",
      record: {
        ...adapterRecord,
        fieldValues: {
          ...adapterRecord.fieldValues,
          Record_Url__c: "javascript:alert(1)",
        },
        sourceUrl: "javascript:alert(2)",
      },
      source: {
        ...salesforceSource,
        sourceUrl: "javascript:alert(3)",
      },
    });

    expect(result.syncStatus).toBe("completed");
    expect(result.updatedSource.sourceLinkHealth).toBe("missing");
    expect(result.updatedSource.sourceUrl).toBeUndefined();
    expect(result.launchContextRecords[0].sourceUrl).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("javascript:");
  });

  it("guards malformed field mappings without throwing", () => {
    const result = buildSalesforceLaunchContextIngestionResult({
      actorId: "Admin Reviewer",
      record: {
        ...adapterRecord,
        fieldMapping: {
          accountClientLabel: "Client_Label__c",
          commercialContext: null,
          opportunityOrEngagementId: "Opportunity_Number__c",
          stakeholderNamesOrRoles: undefined,
        },
      } as unknown as SalesforceAdapterRecord,
      source: salesforceSource,
    });

    expect(result).toMatchObject({
      launchContextRecords: [],
      reasonState: "missing_information",
      syncStatus: "skipped",
    });
  });

  it("blocks credential-like and raw-payload mapped fields", () => {
    const result = buildSalesforceLaunchContextIngestionResult({
      actorId: "Admin Reviewer",
      record: {
        ...adapterRecord,
        fieldMapping: {
          ...fieldMapping,
          commercialContext: [
            "Permitted_Commercial_Context__c",
            "BearerToken__c",
            "RawPayload__c",
          ],
          stakeholderNamesOrRoles: ["Executive_Sponsor__c", "SessionId__c"],
        },
        fieldValues: {
          ...adapterRecord.fieldValues,
          BearerToken__c: "secret bearer token",
          RawPayload__c: '{"raw":"payload"}',
          SessionId__c: "secret session",
        },
        permittedFieldNames: [
          ...adapterRecord.permittedFieldNames,
          "BearerToken__c",
          "RawPayload__c",
          "SessionId__c",
        ],
      },
      source: salesforceSource,
    });

    expect(result.launchContextRecords[0]).toMatchObject({
      commercialContext: ["Phase 2 expansion is in contracting."],
      stakeholderNamesOrRoles: ["Regional VP sponsor"],
    });
    expect(JSON.stringify(result)).not.toContain("secret bearer token");
    expect(JSON.stringify(result)).not.toContain("secret session");
    expect(JSON.stringify(result)).not.toContain("payload");
  });

  it("formats user-safe Salesforce sync summaries", () => {
    const result = buildSalesforceLaunchContextIngestionResult({
      actorId: "Admin Reviewer",
      record: adapterRecord,
      source: salesforceSource,
    });

    expect(getSalesforceIngestionResultMessage(result)).toBe(
      "1 Salesforce launch context record prepared for retrieval.",
    );
  });
});
