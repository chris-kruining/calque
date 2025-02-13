import { Parser } from "../parser";

export function createParser(): Parser {
    return {
        parse(source) {
            // console.log(source);

            for (const token of tokenize(source)) {
                console.log(token);
            }

            return {
                nodes: [],
            };
        },
    };
}

// const states = {
//     none(): State {

//     },
// } as const;


type Token = { start: number, length: number } & (
    | { kind: 'bold' }
    | { kind: 'italic' }
    | { kind: 'underline' }
    | { kind: 'strikethrough' }
    | { kind: 'header', level: number }
    | { kind: 'text', value: string }
);
function* tokenize(characters: string): Generator<Token, void, unknown> {
    let buffer: string = '';
    let clearBuffer = false;
    let start = 0;
    let i = 0;

    for (const character of characters) {
        if (buffer.length === 0) {
            start = i;
        }

        buffer += character;
        const length = buffer.length;

        if (buffer === '**') {
            yield { kind: 'bold', start, length };
            clearBuffer = true;
        }
        else if (buffer === '') {
            yield { kind: 'italic', start, length };
            clearBuffer = true;
        }
        else if (buffer === ':') {
            yield { kind: 'underline', start, length };
            clearBuffer = true;
        }
        else if (buffer === ':') {
            yield { kind: 'strikethrough', start, length };
            clearBuffer = true;
        }
        else if (buffer.length > 1 && buffer.startsWith('#') && buffer.endsWith(' ')) {
            yield { kind: 'header', start, length, level: buffer.length - 1 };
            clearBuffer = true;
        }
        else if (buffer.length > 1 && buffer.startsWith('"') && buffer.endsWith('"')) {
            yield { kind: 'text', start, length, value: buffer.slice(1, buffer.length - 1) };
            clearBuffer = true;
        }

        if (clearBuffer) {
            buffer = '';
            clearBuffer = false;
        }

        i++;
    }
}