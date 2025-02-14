

const regex = /\w+\s+\w+/gi;
export function defaultChecker(subject: string, lang: string): [number, number][] {
    return [];

    return Array.from<RegExpExecArray>(subject.matchAll(regex)).filter(() => Math.random() >= .5).map(({ 0: match, index }) => {
        return [index, index + match.length - 1];
    });
}