// --- AST Node types ---

export interface TermNode {
	type: "term";
	value: string;
}

export interface AndNode {
	type: "and";
	left: QueryNode;
	right: QueryNode;
}

export interface OrNode {
	type: "or";
	left: QueryNode;
	right: QueryNode;
}

export interface NotNode {
	type: "not";
	operand: QueryNode;
}

export type QueryNode = TermNode | AndNode | OrNode | NotNode;

// --- Token types ---

enum TokenType {
	BAREWORD,
	QUOTED_STRING,
	AND,
	OR,
	NOT,
	LPAREN,
	RPAREN,
}

interface Token {
	type: TokenType;
	value: string;
}

// --- Lexer ---

function tokenize(input: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;

	while (i < input.length) {
		// Skip whitespace
		if (/\s/.test(input[i])) {
			i++;
			continue;
		}

		// Parentheses
		if (input[i] === "(") {
			tokens.push({ type: TokenType.LPAREN, value: "(" });
			i++;
			continue;
		}
		if (input[i] === ")") {
			tokens.push({ type: TokenType.RPAREN, value: ")" });
			i++;
			continue;
		}

		// Quoted string
		if (input[i] === '"' || input[i] === "'") {
			const quote = input[i];
			i++;
			let str = "";
			while (i < input.length && input[i] !== quote) {
				if (input[i] === "\\" && i + 1 < input.length) {
					i++;
					str += input[i];
				} else {
					str += input[i];
				}
				i++;
			}
			if (i < input.length) i++; // skip closing quote
			tokens.push({ type: TokenType.QUOTED_STRING, value: str });
			continue;
		}

		// Bareword (including keywords)
		let word = "";
		while (i < input.length && !/[\s()"']/.test(input[i])) {
			word += input[i];
			i++;
		}

		const upper = word.toUpperCase();
		if (upper === "AND") {
			tokens.push({ type: TokenType.AND, value: word });
		} else if (upper === "OR") {
			tokens.push({ type: TokenType.OR, value: word });
		} else if (upper === "NOT") {
			tokens.push({ type: TokenType.NOT, value: word });
		} else {
			tokens.push({ type: TokenType.BAREWORD, value: word });
		}
	}

	return tokens;
}

// --- Recursive descent parser ---
// Precedence: OR (lowest) < AND < NOT (highest)
// Implicit AND between adjacent terms

class Parser {
	private tokens: Token[];
	private pos: number;

	constructor(tokens: Token[]) {
		this.tokens = tokens;
		this.pos = 0;
	}

	private peek(): Token | null {
		return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
	}

	private advance(): Token {
		return this.tokens[this.pos++];
	}

	private expect(type: TokenType): Token {
		const tok = this.peek();
		if (!tok || tok.type !== type) {
			throw new Error(
				`Expected token type ${type}, got ${tok ? tok.type : "EOF"}`,
			);
		}
		return this.advance();
	}

	// Check if the next token can start a primary expression
	private canStartPrimary(): boolean {
		const tok = this.peek();
		if (!tok) return false;
		return (
			tok.type === TokenType.BAREWORD ||
			tok.type === TokenType.QUOTED_STRING ||
			tok.type === TokenType.NOT ||
			tok.type === TokenType.LPAREN
		);
	}

	parse(): QueryNode {
		const node = this.parseOr();
		if (this.pos < this.tokens.length) {
			throw new Error(`Unexpected token: "${this.tokens[this.pos].value}"`);
		}
		return node;
	}

	// OR has lowest precedence
	private parseOr(): QueryNode {
		let left = this.parseAnd();

		while (this.peek()?.type === TokenType.OR) {
			this.advance();
			const right = this.parseAnd();
			left = { type: "or", left, right };
		}

		return left;
	}

	// AND — explicit AND keyword or implicit (adjacent terms)
	private parseAnd(): QueryNode {
		let left = this.parseNot();

		while (true) {
			const tok = this.peek();

			if (tok?.type === TokenType.AND) {
				this.advance();
				const right = this.parseNot();
				left = { type: "and", left, right };
			} else if (this.canStartPrimary()) {
				// Implicit AND
				const right = this.parseNot();
				left = { type: "and", left, right };
			} else {
				break;
			}
		}

		return left;
	}

	// NOT — highest precedence unary operator
	private parseNot(): QueryNode {
		if (this.peek()?.type === TokenType.NOT) {
			this.advance();
			const operand = this.parseNot();
			return { type: "not", operand };
		}
		return this.parsePrimary();
	}

	// Primary — term, quoted string, or parenthesized group
	private parsePrimary(): QueryNode {
		const tok = this.peek();

		if (!tok) {
			throw new Error("Unexpected end of query");
		}

		if (tok.type === TokenType.LPAREN) {
			this.advance();
			const node = this.parseOr();
			this.expect(TokenType.RPAREN);
			return node;
		}

		if (
			tok.type === TokenType.BAREWORD ||
			tok.type === TokenType.QUOTED_STRING
		) {
			this.advance();
			return { type: "term", value: tok.value };
		}

		throw new Error(`Unexpected token: "${tok.value}"`);
	}
}

// --- Public API ---

export function parse(query: string): QueryNode {
	const trimmed = query.trim();
	if (trimmed === "") {
		// Empty query: match everything — represent as a term that always matches
		return { type: "term", value: "" };
	}

	const tokens = tokenize(trimmed);
	if (tokens.length === 0) {
		return { type: "term", value: "" };
	}

	const parser = new Parser(tokens);
	return parser.parse();
}

export function evaluate(node: QueryNode, text: string): boolean {
	const lowerText = text.toLowerCase();

	switch (node.type) {
		case "term":
			// Empty term matches everything
			if (node.value === "") return true;
			return lowerText.includes(node.value.toLowerCase());
		case "and":
			return evaluate(node.left, text) && evaluate(node.right, text);
		case "or":
			return evaluate(node.left, text) || evaluate(node.right, text);
		case "not":
			return !evaluate(node.operand, text);
	}
}
