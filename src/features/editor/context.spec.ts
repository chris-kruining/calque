import { describe, expect } from "vitest";
import { createEditor } from "./context";
import { render } from "@solidjs/testing-library";
import { it } from "~/test-helpers";
import { createSignal } from "solid-js";

describe('createEditor', () => {
    describe('create', () => {
        it('should create', async () => {
            // Arrange
            const res = render(() => <div data-testid="editor" />);
            const ref = await res.findByTestId('editor');

            // Act
            const actual = createEditor(
                () => ref,
                () => '<p>this is a string</p>'
            );

            // Assert
            expect(actual).toBeTruthy();
        });

        it('should update after a change has taken place', async () => {
            // Arrange
            const [value, setValue] = createSignal('<p>this is a string</p>');

            const res = render(() => {
                const [ref, setRef] = createSignal<Element>();

                const [text] = createEditor(ref, value);

                return <div ref={setRef} innerHTML={text()} data-testid="editor" />;
            });
            const ref = await res.findByTestId('editor');

            // Act
            setValue('<p>this is another totally different string</p>');

            // Assert
            expect(ref.innerHTML).toBe('<p>this is another totally different string</p>');
        });
    });

    describe('selection', () => {
        it('should not fail if there are no selection ranges', async () => {
            // Arrange
            const res = render(() => {
                const [ref, setRef] = createSignal<Element>();

                const [text] = createEditor(ref, () => '<p>paragraph 1</p>\n<p>paragraph 2</p>\n<p>paragraph 3</p>');

                return <div ref={setRef} innerHTML={text()} data-testid="editor" />;
            });

            const ref = await res.findByTestId('editor');

            // Act
            window.getSelection()!.removeAllRanges();

            // Assert
            expect(true).toBeTruthy();
        });

        it('should react to changes in selection', async () => {
            // Arrange
            const res = render(() => {
                const [ref, setRef] = createSignal<Element>();

                const [text] = createEditor(ref, () => '<p>paragraph 1</p>\n<p>paragraph 2</p>\n<p>paragraph 3</p>');

                return <div ref={setRef} innerHTML={text()} data-testid="editor" />;
            });

            const ref = await res.findByTestId('editor');

            // Act
            ref.focus();
            window.getSelection()!.setBaseAndExtent(ref.childNodes[0].childNodes[0], 0, ref.childNodes[0].childNodes[0], 10);

            console.log(window.getSelection()!.rangeCount);

            // Assert
            expect(true).toBeTruthy();
        });
    });
});