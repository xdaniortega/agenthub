import type { AgentArchetype } from "./index.js";

export const documentArchetype: AgentArchetype = {
    id: "document",
    name: "Document Agent",
    emoji: "📄",
    description: "Document analysis, content extraction, and transformation",

    skills: [
        "natural_language_processing/information_extraction",
        "natural_language_processing/natural_language_generation/text_generation",
        "analytical_skills/data_transformation",
    ],
    domains: ["technology/data_management"],

    systemPrompt: `You are a Document Agent registered on the ERC-8004 protocol. You specialise in processing, analysing, and transforming text documents.

Your capabilities:
- Analyse documents to identify structure, key themes, and important information
- Extract structured data: entities (people, organisations, dates, amounts), relationships, and facts
- Transform content into different formats (summaries, bullet points, tables, translations)
- Compare multiple documents to find similarities, differences, and contradictions

Be precise, thorough, and structured in your outputs. When extracting information, provide confidence levels where appropriate.`,

    mcpTools: [
        {
            name: "analyze_document",
            description: "Analyse a text document and return key insights",
            inputSchema: {
                type: "object",
                properties: {
                    content: { type: "string", description: "The document text to analyse" },
                },
                required: ["content"],
            },
            implementation: `const content = args.content as string;
      const response = await generateResponse(
        \`Analyse the following document. Identify: main topic, key themes, document type, tone, and 5 most important points.\\n\\n\${content}\`
      );
      return { analysis: response };`,
        },
        {
            name: "extract_entities",
            description: "Extract named entities from document text",
            inputSchema: {
                type: "object",
                properties: {
                    content: { type: "string", description: "The document text" },
                    entity_types: {
                        type: "array",
                        items: { type: "string" },
                        description: "Types to extract: person, organization, date, location, amount (default: all)",
                    },
                },
                required: ["content"],
            },
            implementation: `const content = args.content as string;
      const entityTypes = (args.entity_types as string[]) || ['person', 'organization', 'date', 'location', 'amount'];
      const response = await generateResponse(
        \`Extract the following entity types from this text: \${entityTypes.join(', ')}.\\nReturn as JSON with entity type as key and array of found values.\\n\\n\${content}\`
      );
      return { entities: response };`,
        },
        {
            name: "transform_content",
            description: "Transform document content into a different format",
            inputSchema: {
                type: "object",
                properties: {
                    content: { type: "string", description: "The source document text" },
                    target_format: {
                        type: "string",
                        enum: ["summary", "bullets", "table", "translation"],
                        description: "The desired output format",
                    },
                    language: {
                        type: "string",
                        description: "Target language for translation (e.g. Spanish, French)",
                    },
                },
                required: ["content", "target_format"],
            },
            implementation: `const content = args.content as string;
      const targetFormat = args.target_format as string;
      const language = args.language as string | undefined;

      const formatInstructions: Record<string, string> = {
        summary: 'Write a concise summary (2-3 paragraphs) of the following document:',
        bullets: 'Convert the following document into a clear bullet-point list of key points:',
        table: 'Convert the following document into a Markdown table with relevant columns:',
        translation: \`Translate the following document to \${language || 'Spanish'}:\`,
      };

      const instruction = formatInstructions[targetFormat] || formatInstructions.summary;
      const response = await generateResponse(\`\${instruction}\\n\\n\${content}\`);
      return { result: response, format: targetFormat };`,
        },
    ],

    extraDependencies: {},
    requiredFeatures: ["a2a", "mcp"],
    extraTemplates: [],
};
