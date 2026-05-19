import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'JT ALWM TEAM API',
      description: 'API REST pour gestion des uploads vidéo et scripts par semaine et par pays',
      version: '1.0.0',
      contact: {
        name: 'Support',
        email: 'support@jtalwm.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3010',
        description: 'Development server',
      },
      {
        url: 'https://api.jtalwm.com',
        description: 'Production server',
      },
    ],
    components: {
      schemas: {
        FileUpload: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique file identifier',
            },
            name: {
              type: 'string',
              description: 'Original filename',
            },
            filename: {
              type: 'string',
              description: 'Stored filename on server',
            },
            type: {
              type: 'string',
              enum: ['video', 'script'],
              description: 'File type',
            },
            size: {
              type: 'string',
              description: 'File size in human-readable format',
            },
            status: {
              type: 'string',
              enum: ['completed', 'failed'],
              description: 'Upload status',
            },
            uploadedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Upload timestamp',
            },
          },
        },
        Country: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Country code (ISO 2)',
            },
            name: {
              type: 'string',
              description: 'Country name',
            },
          },
        },
        Week: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Week identifier',
            },
            start_date: {
              type: 'string',
              format: 'date',
            },
            end_date: {
              type: 'string',
              format: 'date',
            },
          },
        },
        HealthStatus: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['ok'],
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
            version: {
              type: 'string',
            },
          },
        },
        Metrics: {
          type: 'object',
          properties: {
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
            uptime_seconds: {
              type: 'integer',
            },
            requests: {
              type: 'integer',
            },
            uploads: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                successful: { type: 'integer' },
                failed: { type: 'integer' },
                avg_time_ms: { type: 'integer' },
              },
            },
            errors: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                last_error: {
                  type: 'object',
                  nullable: true,
                },
              },
            },
            disk: {
              type: 'object',
              properties: {
                usage_bytes: { type: 'integer' },
                usage_mb: { type: 'integer' },
                usage_gb: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  apis: [],
};

/**
 * Add inline route documentation via JSDoc comments
 * Then combine with options above
 */
export const swaggerDocs = swaggerJsdoc(options);

// Additional route documentation
export const routeDocumentation = {
  '/health': {
    get: {
      tags: ['Health'],
      summary: 'Check API health status',
      description: 'Returns health status of the API (used by monitoring services)',
      responses: {
        200: {
          description: 'API is healthy',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/HealthStatus' },
            },
          },
        },
      },
    },
  },

  '/metrics': {
    get: {
      tags: ['Monitoring'],
      summary: 'Get system metrics',
      description: 'Returns system metrics including uptime, requests, uploads, errors, and disk usage',
      responses: {
        200: {
          description: 'Metrics data',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Metrics' },
            },
          },
        },
        500: {
          description: 'Failed to fetch metrics',
        },
      },
    },
  },

  '/api/countries': {
    get: {
      tags: ['Countries'],
      summary: 'Get all countries',
      description: 'Retrieve the list of all countries',
      responses: {
        200: {
          description: 'List of countries',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/Country' },
              },
            },
          },
        },
      },
    },
  },

  '/api/weeks': {
    get: {
      tags: ['Weeks'],
      summary: 'Get all weeks',
      description: 'Retrieve the list of all available weeks',
      responses: {
        200: {
          description: 'List of weeks',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/Week' },
              },
            },
          },
        },
      },
    },
  },

  '/api/uploads/{weekId}': {
    get: {
      tags: ['Uploads'],
      summary: 'Get all uploads for a week',
      description: 'Retrieve all files uploaded for all countries in a specific week',
      parameters: [
        {
          name: 'weekId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Week identifier',
        },
      ],
      responses: {
        200: {
          description: 'List of uploads for the week',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  weekId: { type: 'string' },
                  uploads: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/FileUpload' },
                  },
                },
              },
            },
          },
        },
        404: {
          description: 'Week not found',
        },
      },
    },
  },

  '/api/uploads/{weekId}/{countryId}': {
    get: {
      tags: ['Uploads'],
      summary: 'Get uploads for a country in a week',
      description: 'Retrieve all files uploaded by a specific country in a specific week',
      parameters: [
        {
          name: 'weekId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'countryId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'List of uploads',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/FileUpload' },
              },
            },
          },
        },
        404: {
          description: 'Week or country not found',
        },
      },
    },
    post: {
      tags: ['Uploads'],
      summary: 'Upload a file',
      description: 'Upload a video or script file for a country in a week',
      parameters: [
        {
          name: 'weekId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'countryId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                file: {
                  type: 'string',
                  format: 'binary',
                  description: 'File to upload (mp4, mov, mp3, wav, txt, docx)',
                },
              },
              required: ['file'],
            },
          },
        },
      },
      responses: {
        201: {
          description: 'File uploaded successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/FileUpload' },
            },
          },
        },
        400: {
          description: 'Invalid file or request',
        },
        404: {
          description: 'Week or country not found',
        },
      },
    },
  },

  '/api/uploads/{weekId}/{countryId}/archive': {
    get: {
      tags: ['Uploads'],
      summary: 'Download all files as ZIP',
      description: 'Download all files for a country in a week as a ZIP archive',
      parameters: [
        {
          name: 'weekId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'countryId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'ZIP file',
          content: {
            'application/zip': {},
          },
        },
        404: {
          description: 'Week, country, or files not found',
        },
      },
    },
  },

  '/api/uploads/{weekId}/{countryId}/script': {
    post: {
      tags: ['Uploads'],
      summary: 'Create script manually',
      description: 'Manually enter script content (no file upload)',
      parameters: [
        {
          name: 'weekId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'countryId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: 'Script content',
                },
              },
              required: ['content'],
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Script created successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/FileUpload' },
            },
          },
        },
        400: {
          description: 'Empty content or invalid request',
        },
        404: {
          description: 'Week or country not found',
        },
      },
    },
  },

  '/api/uploads/{weekId}/{countryId}/{fileId}': {
    delete: {
      tags: ['Uploads'],
      summary: 'Delete a file',
      description: 'Delete a specific file for a country in a week',
      parameters: [
        {
          name: 'weekId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'countryId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'fileId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        204: {
          description: 'File deleted successfully',
        },
        404: {
          description: 'File not found',
        },
      },
    },
  },
};

export default swaggerDocs;
