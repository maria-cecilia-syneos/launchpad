import { describe, expect, it } from "vitest";

import {
  buildFailedMicrosoftDocumentIngestionResult,
  buildMicrosoftDocumentIngestionResult,
  canIngestMicrosoftDocumentSource,
  parseMicrosoftDocumentText,
  type MicrosoftDocumentAdapterRecord,
} from "./source-ingestion";
import {
  buildSourceRegistrationRecord,
  createPrototypeSourceRecords,
} from "./source-ledger";

const approvedSharePointSource = createPrototypeSourceRecords()[0];

const wordSource = buildSourceRegistrationRecord(
  {
    accessState: "authorized",
    approvalState: "approved",
    freshnessState: "watch",
    ingestionStatus: "ready",
    objectId: "word-cardiomax-faq",
    owningTeam: "Medical Launch",
    sourceName: "CARDIOMAX FAQ",
    sourceSystem: "word_pdf",
    sourceType: "word_document",
    sourceUrl: "https://contoso.sharepoint.com/sites/launch/CARDIOMAX-FAQ.docx",
  },
  {
    registeredAt: "2026-05-21T12:30:00.000Z",
    sourceId: "src-cardiomax-faq",
  },
);

const adapterRecord: MicrosoftDocumentAdapterRecord = {
  documentKind: "word_document",
  lastModifiedAt: "2026-05-21T13:00:00.000Z",
  objectId: "graph-word-cardiomax-faq",
  owner: "Medical Launch",
  sourceUrl: "https://contoso.sharepoint.com/sites/launch/CARDIOMAX-FAQ.docx",
  textContent:
    "CARDIOMAX launch questions should cite approved prescribing context.\n\nTraining owners must verify updated claims before field use.",
  title: "CARDIOMAX FAQ",
};

describe("source ingestion domain helpers", () => {
  it("allows only approved, authorized SharePoint, Word, or PDF sources", () => {
    const [, smartsheetSource, restrictedSource] = createPrototypeSourceRecords();

    expect(canIngestMicrosoftDocumentSource(approvedSharePointSource)).toBe(true);
    expect(canIngestMicrosoftDocumentSource(wordSource)).toBe(true);
    expect(canIngestMicrosoftDocumentSource(smartsheetSource)).toBe(false);
    expect(canIngestMicrosoftDocumentSource(restrictedSource)).toBe(false);
  });

  it("normalizes Microsoft document ingestion without raw Graph payloads or tokens", () => {
    const result = buildMicrosoftDocumentIngestionResult({
      actorId: "Admin Reviewer",
      correlationId: "corr-source-sync-1",
      document: {
        ...adapterRecord,
        credentialToken: "never-render",
        rawGraphPayload: {
          "@odata.context": "raw-response",
          secret: "sensitive",
        },
      } as MicrosoftDocumentAdapterRecord,
      occurredAt: "2026-05-21T13:05:00.000Z",
      source: wordSource,
    });

    expect(result.syncStatus).toBe("completed");
    expect(result.updatedSource).toMatchObject({
      approvalState: "approved",
      accessState: "authorized",
      freshnessState: "fresh",
      ingestionStatus: "complete",
      lastRefreshedAt: "2026-05-21T13:00:00.000Z",
      objectId: "graph-word-cardiomax-faq",
      owningTeam: "Medical Launch",
      sourceId: "src-cardiomax-faq",
      sourceName: "CARDIOMAX FAQ",
      sourceSystem: "word_pdf",
      sourceUrl:
        "https://contoso.sharepoint.com/sites/launch/CARDIOMAX-FAQ.docx",
    });
    expect(result.extractedRecords).toHaveLength(2);
    expect(result.extractedRecords[0]).toMatchObject({
      documentTitle: "CARDIOMAX FAQ",
      sourceId: "src-cardiomax-faq",
      sourceObjectId: "graph-word-cardiomax-faq",
      sourceSystem: "word_pdf",
      sourceUrl:
        "https://contoso.sharepoint.com/sites/launch/CARDIOMAX-FAQ.docx",
    });
    expect(result.auditEvent).toMatchObject({
      actorId: "Admin Reviewer",
      correlationId: "corr-source-sync-1",
      eventType: "source.sync_completed",
      metadata: {
        extractedRecordCount: 2,
        freshnessState: "fresh",
        sourceId: "src-cardiomax-faq",
        sourceSystem: "word_pdf",
        syncStatus: "completed",
      },
      occurredAt: "2026-05-21T13:05:00.000Z",
      sourceSystem: "word_pdf",
    });
    expect(JSON.stringify(result)).not.toContain("credentialToken");
    expect(JSON.stringify(result)).not.toContain("rawGraphPayload");
    expect(JSON.stringify(result)).not.toContain("raw-response");
    expect(JSON.stringify(result)).not.toContain("sensitive");
  });

  it("extracts normalized retrieval records linked to the original source location", () => {
    const records = parseMicrosoftDocumentText({
      document: adapterRecord,
      source: wordSource,
    });

    expect(records).toEqual([
      expect.objectContaining({
        chunkIndex: 0,
        documentTitle: "CARDIOMAX FAQ",
        normalizedText:
          "CARDIOMAX launch questions should cite approved prescribing context.",
        sourceId: "src-cardiomax-faq",
        sourceLocationKey: "word-cardiomax-faq",
      }),
      expect.objectContaining({
        chunkIndex: 1,
        normalizedText:
          "Training owners must verify updated claims before field use.",
        sourceId: "src-cardiomax-faq",
        sourceLocationKey: "word-cardiomax-faq",
      }),
    ]);
  });

  it("maps connector and parsing failures to user-safe failed or incomplete states", () => {
    const connectorFailure = buildFailedMicrosoftDocumentIngestionResult({
      actorId: "Admin Reviewer",
      correlationId: "corr-source-sync-fail",
      failureState: "connector_unavailable",
      occurredAt: "2026-05-21T13:10:00.000Z",
      source: approvedSharePointSource,
    });
    const missingContentFailure = buildFailedMicrosoftDocumentIngestionResult({
      actorId: "Admin Reviewer",
      failureState: "missing_information",
      occurredAt: "2026-05-21T13:11:00.000Z",
      source: wordSource,
    });

    expect(connectorFailure).toMatchObject({
      failureState: "connector_unavailable",
      syncStatus: "failed",
      userSafeReason:
        "Microsoft document content could not be retrieved. Check connector availability and source access.",
      updatedSource: {
        freshnessState: "stale",
        ingestionStatus: "failed",
        lastRefreshedAt: "2026-05-21T13:10:00.000Z",
      },
    });
    expect(connectorFailure.auditEvent).toMatchObject({
      eventType: "source.sync_failed",
      metadata: {
        failureState: "connector_unavailable",
        freshnessState: "stale",
        syncStatus: "failed",
      },
    });
    expect(missingContentFailure).toMatchObject({
      failureState: "missing_information",
      syncStatus: "incomplete",
      userSafeReason:
        "Microsoft document content is missing required metadata or readable text.",
      updatedSource: {
        freshnessState: "watch",
        ingestionStatus: "incomplete",
        lastRefreshedAt: "2026-05-21T13:11:00.000Z",
      },
    });
  });

  it("returns a safe incomplete result when a retrieved document has no text", () => {
    const result = buildMicrosoftDocumentIngestionResult({
      actorId: "Admin Reviewer",
      document: {
        ...adapterRecord,
        textContent: "   ",
      },
      source: wordSource,
    });

    expect(result.syncStatus).toBe("incomplete");
    expect(result.extractedRecords).toEqual([]);
    expect(result.userSafeReason).toBe(
      "Microsoft document content is missing required metadata or readable text.",
    );
  });
});
