// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file sizeQueries.ts
 * @input Viewport or container edges in CSS pixels
 * @output The media-query spellings of a size edge: range features for script
 *   and plain CSS, and the StyleX at-rule key for "below an edge"
 * @position The one place Core spells a width or height edge. The theme's
 *   compact definition, its adaptation rules, AppShell's breakpoint and the
 *   touch presentation keys read it; sizeQueries.test.ts keeps every other
 *   spelling out of Core.
 */

// StyleX lowers a range feature such as `(width < 768px)` to
// `(max-width: 767.99px)`. Chromium rounds that length up to 768px, so the
// rule also matches at exactly 768px wide, where the wider side must apply.
// A StyleX key therefore says "below" as the negation of the
// inclusive lower edge, which StyleX keeps as written and every browser
// answers exactly. Script and plain CSS keep the range features, which the
// browser reads directly.

/** A width strictly below `px`, as a media feature for script or plain CSS. */
export function widthBelowFeature(px: number): string {
  return `(width < ${px}px)`;
}

/** A height strictly below `px`, as a media feature for script or plain CSS. */
export function heightBelowFeature(px: number): string {
  return `(height < ${px}px)`;
}

/** A width at or above `px`, as a media feature for script or plain CSS. */
export function widthFromFeature(px: number): string {
  return `(width >= ${px}px)`;
}

/** The edges of a "below" condition: true below the width, or below the height. */
export interface BelowEdges {
  /** Matches below this width. */
  readonly width: number;
  /** Also matches below this height. */
  readonly height?: number;
}

/**
 * The StyleX media key for "narrower than `width`, or shorter than `height`".
 * Write the returned string as a literal key: a computed key gets a different
 * StyleX priority.
 */
export function belowStyleKey({width, height}: BelowEdges): string {
  const heightEdge =
    height === undefined ? '' : ` and (min-height: ${height}px)`;
  return `@media not all and (min-width: ${width}px)${heightEdge}`;
}
