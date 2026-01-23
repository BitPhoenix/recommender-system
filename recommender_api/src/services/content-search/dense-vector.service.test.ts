import { describe, it, expect } from "vitest";
import { cosineSimilarity, computeCentroid } from "./dense-vector.service.js";

describe("cosineSimilarity", () => {
  it("returns 1.0 for identical vectors", () => {
    const vector = [1, 2, 3];
    expect(cosineSimilarity(vector, vector)).toBeCloseTo(1.0, 5);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("returns -1 for opposite vectors", () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
  });

  it("returns 0 when either vector is zero", () => {
    const zero = [0, 0, 0];
    const nonZero = [1, 2, 3];
    expect(cosineSimilarity(zero, nonZero)).toBe(0);
    expect(cosineSimilarity(nonZero, zero)).toBe(0);
  });

  it("throws error for mismatched dimensions", () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(() => cosineSimilarity(a, b)).toThrow("Vectors must have same dimensions");
  });

  it("handles negative values correctly", () => {
    const a = [1, -1, 0];
    const b = [1, 1, 0];
    // dot product = 1*1 + (-1)*1 = 0, so orthogonal
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("returns same similarity regardless of vector magnitude", () => {
    const a = [1, 2, 3];
    const b = [2, 4, 6]; // Same direction, different magnitude
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
  });

  it("computes correct similarity for normalized vectors", () => {
    // Two unit vectors at 60 degrees apart have cosine similarity of 0.5
    const a = [1, 0];
    const b = [0.5, Math.sqrt(3) / 2]; // 60 degrees from a
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.5, 5);
  });
});

describe("computeCentroid", () => {
  it("returns the vector itself for single vector input", () => {
    const vectors = [[1, 2, 3]];
    expect(computeCentroid(vectors)).toEqual([1, 2, 3]);
  });

  it("computes average for multiple vectors", () => {
    const vectors = [
      [2, 4],
      [4, 2],
      [6, 6],
    ];
    // Expected: [(2+4+6)/3, (4+2+6)/3] = [4, 4]
    expect(computeCentroid(vectors)).toEqual([4, 4]);
  });

  it("throws error for empty vector set", () => {
    expect(() => computeCentroid([])).toThrow("Cannot compute centroid of empty vector set");
  });

  it("handles negative values", () => {
    const vectors = [
      [1, -1],
      [-1, 1],
    ];
    expect(computeCentroid(vectors)).toEqual([0, 0]);
  });

  it("handles high-dimensional vectors", () => {
    const vectors = [
      [1, 2, 3, 4, 5],
      [5, 4, 3, 2, 1],
    ];
    // Each dimension: (1+5)/2=3, (2+4)/2=3, (3+3)/2=3, (4+2)/2=3, (5+1)/2=3
    expect(computeCentroid(vectors)).toEqual([3, 3, 3, 3, 3]);
  });

  it("handles floating point values", () => {
    const vectors = [
      [0.1, 0.2],
      [0.3, 0.4],
    ];
    const centroid = computeCentroid(vectors);
    expect(centroid[0]).toBeCloseTo(0.2, 5);
    expect(centroid[1]).toBeCloseTo(0.3, 5);
  });
});
