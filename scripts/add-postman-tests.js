#!/usr/bin/env node
/**
 * Script to add test assertions to Postman collection
 * Run with: node scripts/add-postman-tests.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const collectionPath = join(__dirname, '../postman/collections/search-filter-tests.postman_collection.json');

// Standard test script for successful requests (200)
const standardSuccessTests = [
  "pm.test('Status code is 200', function () {",
  "    pm.response.to.have.status(200);",
  "});",
  "",
  "pm.test('Response has required top-level fields', function () {",
  "    const response = pm.response.json();",
  "    pm.expect(response).to.have.property('matches');",
  "    pm.expect(response).to.have.property('queryMetadata');",
  "    pm.expect(response).to.have.property('totalCount');",
  "    pm.expect(response).to.have.property('appliedFilters');",
  "    pm.expect(response).to.have.property('appliedPreferences');",
  "    pm.expect(response.matches).to.be.an('array');",
  "    pm.expect(response.totalCount).to.be.a('number');",
  "});",
  "",
  "pm.test('queryMetadata has required fields', function () {",
  "    const metadata = pm.response.json().queryMetadata;",
  "    pm.expect(metadata).to.have.property('executionTimeMs');",
  "    pm.expect(metadata).to.have.property('skillsExpanded');",
  "    pm.expect(metadata).to.have.property('defaultsApplied');",
  "    pm.expect(metadata.executionTimeMs).to.be.a('number');",
  "});",
  "",
  "pm.test('Each match has required fields', function () {",
  "    const matches = pm.response.json().matches;",
  "    matches.forEach(function(match) {",
  "        pm.expect(match).to.have.property('id');",
  "        pm.expect(match).to.have.property('name');",
  "        pm.expect(match).to.have.property('utilityScore');",
  "        pm.expect(match).to.have.property('scoreBreakdown');",
  "        pm.expect(match.utilityScore).to.be.a('number');",
  "        pm.expect(match.utilityScore).to.be.at.least(0);",
  "        pm.expect(match.utilityScore).to.be.at.most(1);",
  "    });",
  "});"
];

// Test script for validation error requests (400)
const validationErrorTests = [
  "pm.test('Status code is 400', function () {",
  "    pm.response.to.have.status(400);",
  "});",
  "",
  "pm.test('Response indicates validation failure', function () {",
  "    const response = pm.response.json();",
  "    pm.expect(response.success).to.equal(false);",
  "    pm.expect(response.error).to.have.property('name');",
  "    pm.expect(response.error.name).to.equal('ZodError');",
  "    pm.expect(response.error).to.have.property('issues');",
  "    pm.expect(response.error.issues).to.be.an('array');",
  "});"
];

// New validation test cases to add
const newValidationTests = [
  {
    name: "43 - Validation: stretchBudget less than maxBudget",
    body: { maxBudget: 200000, stretchBudget: 180000 },
    tests: [
      ...validationErrorTests,
      "",
      "pm.test('Error mentions stretchBudget constraint', function () {",
      "    const response = pm.response.json();",
      "    const issueText = JSON.stringify(response.error.issues);",
      "    pm.expect(issueText).to.include('stretchBudget');",
      "});"
    ],
    description: "## Validation: stretchBudget Less Than maxBudget\n\nTests that stretchBudget must be >= maxBudget.\n\n**Expected:** 400 Bad Request with ZodError"
  },
  {
    name: "44 - Validation: preferredMaxStartTime later than requiredMaxStartTime",
    body: { requiredMaxStartTime: "two_weeks", preferredMaxStartTime: "one_month" },
    tests: [
      ...validationErrorTests,
      "",
      "pm.test('Error mentions timeline constraint', function () {",
      "    const response = pm.response.json();",
      "    const issueText = JSON.stringify(response.error.issues);",
      "    pm.expect(issueText.toLowerCase()).to.include('preferred');",
      "});"
    ],
    description: "## Validation: preferredMaxStartTime Later Than Required\n\nTests that preferredMaxStartTime cannot be later than requiredMaxStartTime.\n\n**Expected:** 400 Bad Request with ZodError"
  },
  {
    name: "45 - Validation: negative limit",
    body: { limit: -1 },
    tests: [
      ...validationErrorTests,
      "",
      "pm.test('Error mentions limit constraint', function () {",
      "    const response = pm.response.json();",
      "    const issueText = JSON.stringify(response.error.issues);",
      "    pm.expect(issueText).to.include('limit');",
      "});"
    ],
    description: "## Validation: Negative Limit\n\nTests that limit must be positive.\n\n**Expected:** 400 Bad Request with ZodError"
  }
];

// New edge case tests to add
const newEdgeCaseTests = [
  {
    name: "46 - Edge Case: Unresolved skill (returns all with warning)",
    body: { requiredSkills: [{ skill: "extremely-rare-skill-xyz-nonexistent", minProficiency: "expert" }] },
    tests: [
      "pm.test('Status code is 200', function () {",
      "    pm.response.to.have.status(200);",
      "});",
      "",
      "pm.test('Returns matches (browse mode when skill unresolved)', function () {",
      "    const matches = pm.response.json().matches;",
      "    pm.expect(matches).to.be.an('array');",
      "    // When skill is unresolved, API falls back to browse mode",
      "});",
      "",
      "pm.test('Unresolved skill is reported in queryMetadata', function () {",
      "    const metadata = pm.response.json().queryMetadata;",
      "    pm.expect(metadata).to.have.property('unresolvedSkills');",
      "    pm.expect(metadata.unresolvedSkills).to.be.an('array');",
      "    pm.expect(metadata.unresolvedSkills).to.include('extremely-rare-skill-xyz-nonexistent');",
      "});",
      "",
      "pm.test('Response still has required structure', function () {",
      "    const response = pm.response.json();",
      "    pm.expect(response).to.have.property('appliedFilters');",
      "    pm.expect(response).to.have.property('appliedPreferences');",
      "    pm.expect(response).to.have.property('queryMetadata');",
      "});"
    ],
    description: "## Edge Case: Unresolved Skill\n\nTests behavior when a requested skill doesn't exist in the database.\n\n**Expected:** 200 OK with unresolvedSkills array populated - falls back to browse mode"
  },
  {
    name: "47 - Edge Case: High offset (pagination beyond results)",
    body: { offset: 10000, limit: 20 },
    tests: [
      "pm.test('Status code is 200', function () {",
      "    pm.response.to.have.status(200);",
      "});",
      "",
      "pm.test('Returns empty matches array when offset exceeds total', function () {",
      "    const response = pm.response.json();",
      "    pm.expect(response.matches).to.be.an('array');",
      "    // With high offset, we expect empty results",
      "    pm.expect(response.matches.length).to.equal(0);",
      "});",
      "",
      "pm.test('totalCount shows actual total (not affected by offset)', function () {",
      "    const response = pm.response.json();",
      "    // totalCount at top level should reflect the actual number, not the paginated view",
      "    pm.expect(response.totalCount).to.be.a('number');",
      "    pm.expect(response.totalCount).to.be.at.least(0);",
      "});",
      "",
      "pm.test('Response has required structure', function () {",
      "    const response = pm.response.json();",
      "    pm.expect(response).to.have.property('queryMetadata');",
      "    pm.expect(response).to.have.property('appliedFilters');",
      "});"
    ],
    description: "## Edge Case: High Offset\n\nTests pagination when offset exceeds total results.\n\n**Expected:** 200 OK with empty matches but correct totalCount"
  }
];

// Create a test request item
function createRequestItem(name, body, tests, description) {
  return {
    name,
    event: [
      {
        listen: "test",
        script: {
          type: "text/javascript",
          exec: tests
        }
      }
    ],
    request: {
      method: "POST",
      header: [
        {
          key: "Content-Type",
          value: "application/json"
        }
      ],
      body: {
        mode: "raw",
        raw: JSON.stringify(body, null, 2)
      },
      url: {
        raw: "http://localhost:4025/api/search/filter",
        protocol: "http",
        host: ["localhost"],
        port: "4025",
        path: ["api", "search", "filter"]
      },
      description
    }
  };
}

// Main function
function main() {
  console.log('Reading Postman collection...');
  const collection = JSON.parse(readFileSync(collectionPath, 'utf8'));

  let testsAdded = 0;
  let testsSkipped = 0;

  // Add standard tests to existing items that don't have tests
  collection.item.forEach((item, index) => {
    // Skip validation error test (31) - it expects 400
    if (item.name.includes('31 - Validation: stretchBudget Requires maxBudget')) {
      if (!item.event) {
        item.event = [{
          listen: "test",
          script: {
            type: "text/javascript",
            exec: [
              ...validationErrorTests,
              "",
              "pm.test('Error mentions maxBudget requirement', function () {",
              "    const response = pm.response.json();",
              "    const issueText = JSON.stringify(response.error.issues);",
              "    pm.expect(issueText).to.include('maxBudget');",
              "});"
            ]
          }
        }];
        testsAdded++;
        console.log(`  Added validation tests to: ${item.name}`);
      } else {
        testsSkipped++;
      }
      return;
    }

    // Skip validation error test (33) - it expects 400
    if (item.name.includes('33 - Validation Error: Invalid Request')) {
      if (!item.event) {
        item.event = [{
          listen: "test",
          script: {
            type: "text/javascript",
            exec: validationErrorTests
          }
        }];
        testsAdded++;
        console.log(`  Added validation tests to: ${item.name}`);
      } else {
        testsSkipped++;
      }
      return;
    }

    // For all other items, add standard success tests if not present
    if (!item.event) {
      item.event = [{
        listen: "test",
        script: {
          type: "text/javascript",
          exec: standardSuccessTests
        }
      }];
      testsAdded++;
      console.log(`  Added standard tests to: ${item.name}`);
    } else {
      testsSkipped++;
      console.log(`  Skipped (has tests): ${item.name}`);
    }
  });

  // Add new validation test cases
  console.log('\nAdding new validation test cases...');
  newValidationTests.forEach(test => {
    const item = createRequestItem(test.name, test.body, test.tests, test.description);
    collection.item.push(item);
    console.log(`  Added: ${test.name}`);
  });

  // Add new edge case tests
  console.log('\nAdding new edge case tests...');
  newEdgeCaseTests.forEach(test => {
    const item = createRequestItem(test.name, test.body, test.tests, test.description);
    collection.item.push(item);
    console.log(`  Added: ${test.name}`);
  });

  // Write updated collection
  console.log('\nWriting updated collection...');
  writeFileSync(collectionPath, JSON.stringify(collection, null, '\t'), 'utf8');

  console.log('\nSummary:');
  console.log(`  Tests added to existing items: ${testsAdded}`);
  console.log(`  Items already had tests: ${testsSkipped}`);
  console.log(`  New validation tests added: ${newValidationTests.length}`);
  console.log(`  New edge case tests added: ${newEdgeCaseTests.length}`);
  console.log(`  Total items in collection: ${collection.item.length}`);
  console.log('\nDone!');
}

main();
