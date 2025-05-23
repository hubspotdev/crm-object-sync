export const commonSchemas = {
  Contact: {
    type: 'object',
    properties: {
      id: {
        type: 'string'
      },
      email: {
        type: 'string'
      },
      firstName: {
        type: 'string'
      },
      lastName: {
        type: 'string'
      },
      hubspotId: {
        type: 'string'
      },
      createdAt: {
        type: 'string',
        format: 'date-time'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time'
      }
    }
  },
  Error: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Error message'
      }
    }
  },
  SyncResults: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean'
      },
      message: {
        type: 'string'
      },
      syncedCount: {
        type: 'number'
      },
      errors: {
        type: 'array',
        items: {
          type: 'string'
        }
      }
    }
  }
};

export const apiEndpoints = {
  '/contacts': {
    get: {
      summary: 'Get all contacts',
      description: 'Retrieves all contacts from the local database',
      responses: {
        '200': {
          description: 'Successfully retrieved contacts',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Contact'
                }
              }
            }
          }
        },
        '500': {
          description: 'Server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        }
      }
    }
  },
  '/sync-contacts': {
    get: {
      summary: 'Sync contacts to HubSpot',
      description: 'Synchronizes contacts from local database to HubSpot',
      responses: {
        '200': {
          description: 'Sync results',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SyncResults'
              }
            }
          }
        },
        '500': {
          description: 'Server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        }
      }
    }
  },

  '/initial-contacts-sync': {
    get: {
      summary: 'Initial contacts sync from HubSpot',
      description:
        'Performs initial synchronization of contacts from HubSpot to local database',
      responses: {
        '200': {
          description: 'Sync results',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SyncResults'
              }
            }
          }
        },
        '500': {
          description: 'Server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        }
      }
    }
  }
};
