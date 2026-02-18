import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Inmo24x7 API",
      version: "0.1.0",
      description: "API documentation for Inmo24x7 real estate chatbot service",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Lead: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              description: "Unique identifier for the lead",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "When the lead was created",
            },
            operacion: {
              type: "string",
              description: "Type of operation (e.g., compra, alquiler)",
            },
            zona: {
              type: "string",
              description: "Target zone/area",
            },
            presupuestoMax: {
              type: "number",
              description: "Maximum budget",
            },
            nombre: {
              type: "string",
              description: "Lead name",
            },
            contacto: {
              type: "string",
              description: "Contact information",
            },
            summary: {
              type: "string",
              description: "Summary of the lead conversation",
            },
          },
        },
        MessageRequest: {
          type: "object",
          required: ["userId", "text"],
          properties: {
            userId: {
              type: "string",
              description: "Unique identifier for the user",
            },
            text: {
              type: "string",
              description: "Message text from the user",
            },
          },
        },
        MessageResponse: {
          type: "object",
          properties: {
            reply: {
              type: "string",
              description: "Bot response message",
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Error message",
            },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.ts", "./src/index.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
