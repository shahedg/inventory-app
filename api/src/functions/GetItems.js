const { app } = require('@azure/functions');
const sql = require('mssql');

app.http('GetItems', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Processing request for /api/items');

        // 1. Grab the connection string from environment variables
        const connectionString = process.env.SqlConnectionString;

        if (!connectionString) {
            context.log('Error: SqlConnectionString is missing.');
            return {
                status: 500,
                body: "Database connection string is not configured."
            };
        }

        try {
            // 2. Connect to the Azure SQL Database
            await sql.connect(connectionString);

            // 3. Execute the query
            const result = await sql.query(`
                SELECT 
                    i.ItemID,
                    i.ItemName,
                    i.Description,
                    i.ImageURL,
                    i.Status,
                    i.CurrentOwnerID,
                    u.Name AS OwnerName
                FROM Items i
                LEFT JOIN Users u ON i.CurrentOwnerID = u.UserID
            `);

            // 4. Return the data as JSON
            return {
                status: 200,
                jsonBody: result.recordset
            };

        } catch (err) {
            context.log(`Database error: ${err}`);
            return {
                status: 500,
                body: "An error occurred while retrieving items."
            };
        }
    }
});