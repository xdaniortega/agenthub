import type { AgentArchetype } from "./index.js";

export const codeArchetype: AgentArchetype = {
    id: "code",
    name: "Code Agent",
    emoji: "💻",
    description: "Code generation, review, debugging, and explanation",

    skills: [
        "analytical_skills/coding_skills/text_to_code",
        "analytical_skills/coding_skills/code_to_code",
        "analytical_skills/coding_skills/code_to_text",
    ],
    domains: ["technology/software_engineering"],

    systemPrompt: `You are a Code Agent registered on the ERC-8004 protocol. You are an expert software engineer who helps with all aspects of coding.

Your capabilities:
- Generate clean, well-typed, production-quality code from natural language descriptions
- Review existing code and identify bugs, security issues, and improvements
- Explain complex code in clear, understandable terms
- Debug errors and suggest fixes with reasoning
- Suggest refactoring and best practices

Always:
- Include type annotations and comments where helpful
- Follow the language's idiomatic conventions
- Consider edge cases and error handling
- Provide explanations alongside your code`,

    mcpTools: [
        {
            name: "generate_code",
            description: "Generate code from a natural language description",
            inputSchema: {
                type: "object",
                properties: {
                    description: { type: "string", description: "What the code should do" },
                    language: { type: "string", description: "Programming language (e.g. TypeScript, Python)" },
                },
                required: ["description", "language"],
            },
            implementation: `const description = args.description as string;
      const language = args.language as string;
      const response = await generateResponse(
        \`Generate \${language} code for the following: \${description}\\nProvide only the code with inline comments.\`
      );
      return { code: response, language };`,
        },
        {
            name: "review_code",
            description: "Review code for bugs, issues, and improvements",
            inputSchema: {
                type: "object",
                properties: {
                    code: { type: "string", description: "The code to review" },
                    language: { type: "string", description: "Programming language" },
                },
                required: ["code", "language"],
            },
            implementation: `const code = args.code as string;
      const language = args.language as string;
      const response = await generateResponse(
        \`Review this \${language} code for bugs, security issues, performance problems, and style improvements:\\n\\n\${code}\`
      );
      return { review: response };`,
        },
        {
            name: "explain_code",
            description: "Explain what a piece of code does in plain language",
            inputSchema: {
                type: "object",
                properties: {
                    code: { type: "string", description: "The code to explain" },
                },
                required: ["code"],
            },
            implementation: `const code = args.code as string;
      const response = await generateResponse(
        \`Explain the following code in clear, plain language suitable for someone unfamiliar with it:\\n\\n\${code}\`
      );
      return { explanation: response };`,
        },
        {
            name: "debug_code",
            description: "Analyse an error and suggest a fix",
            inputSchema: {
                type: "object",
                properties: {
                    code: { type: "string", description: "The code with the bug" },
                    error: { type: "string", description: "The error message or description of the problem" },
                },
                required: ["code", "error"],
            },
            implementation: `const code = args.code as string;
      const error = args.error as string;
      const response = await generateResponse(
        \`Debug this code. Error: \${error}\\n\\nCode:\\n\${code}\\n\\nExplain the root cause and provide a fixed version.\`
      );
      return { analysis: response };`,
        },
    ],

    extraDependencies: {},
    requiredFeatures: ["a2a", "mcp"],
    extraTemplates: [],
};
