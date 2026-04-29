const { app } = require('@azure/functions');
const sql = require('mssql');

app.http('GetUsers', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const pool = await sql.connect(process.env.SqlConnectionString);
            const result = await pool.request().query('SELECT UserID, Username FROM Users');

            return { jsonBody: result.recordset };
        } catch (err) {
            return { status: 500, body: err.message };
        }
    }
});