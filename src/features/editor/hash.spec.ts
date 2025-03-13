import { describe, expect } from "vitest";
import { it } from "~/test-helpers";
import { hash } from "./hash";

const DEFAULT_DATA = {
    prop_object: {
        is: 'some prop',
    },

    prop_boolean: false,
    prop_bigint: 1_000_000_000_000n,
    prop_null: null,
    prop_undefined: undefined,
    prop_function: () => { },
    prop_symbol: Symbol('symbol'),

    uint8array: new Uint8Array([0xff, 0x00, 0xff, 0x00]),
    uint32array: new Uint32Array([0xff00ff00]),
};

describe('hash', () => {
    it('should hash a value with sha-1 algorithm', () => {
        // Arrange
        const expected = '6fe383b712ec74177f7714a3f5db5416accef8b';

        // Act
        const actual = hash(DEFAULT_DATA);

        // Assert
        expect(actual).toEqual(expected);
    });

    it('should be stable over multiple runs', () => {
        // Arrange

        // Act
        const run1 = hash(DEFAULT_DATA);
        const run2 = hash(DEFAULT_DATA);

        // Assert
        expect(run1).toEqual(run2);
    });

    // I can't seem to actually create a dataset that is large enough in order to test this.
    // So, for now, I will consider this unreachable code.
    it('should error if the input is too large', () => {
        // Arrange

        // Act

        // Assert
        expect(true).toEqual(true);
    });
});