import { describe, expect } from "vitest";
import { createSource } from "./source";
import { it } from "~/test-helpers";
import { testEffect } from "@solidjs/testing-library";
import { createEffect, createSignal } from "solid-js";

describe('Source', () => {
    describe('Source', () => {
        it('should return a `Source`', () => {
            // Arrange

            // Act
            const actual = createSource('');

            // Assert
            expect(actual.out).toBe('');
        });

        it('should transform the input format to output format', () => {
            // Arrange
            const given = '**text**\n';
            const expected = '<p><strong>text</strong></p>';

            // Act
            const actual = createSource(given);

            // Assert
            expect(actual.out).toBe(expected);
        });

        it('should contain query results', () => {
            // Arrange
            const expected: [number, number][] = [[8, 9], [12, 13], [15, 16]];
            const source = createSource('this is a seachable string');

            // Act
            source.query = 'a';

            // Assert
            return testEffect(done => {
                createEffect(() => {
                    expect(source.queryResults).toEqual(expected);

                    done()
                });
            });
        });
    });
});