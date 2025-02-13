enum Decoration {
    None = 0,
    Bold = 1,
    Italic = 2,
    Underline = 4,
    StrikeThrough = 8,
}

interface TextNode {
    type: 'text';
    decoration: Decoration;
    nodes: (string | Node)[];
}

interface HeaderNode {
    type: 'header';
    nodes: Node[];
}

type Node = TextNode | HeaderNode;

export interface RichTextAST {
    nodes: Node[];
}

export interface Parser {
    parse(source: string): RichTextAST;
}