const { app } = require('@azure/functions');
const sql = require('mssql');

app.http('SyncUser', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const { email, name } = await request.json();
            const pool = await sql.connect(process.env.SqlConnectionString);

            // Check if user already exists
            let result = await pool.request()
                .input('email', sql.NVarChar, email)
                .query('SELECT UserID FROM Users WHERE Email = @email');

            let dbUserId;

            if (result.recordset.length > 0) {
                dbUserId = result.recordset[0].UserID;
            } else {
                // If new user, insert them and get the new ID
                const insertResult = await pool.request()
                    .input('email', sql.NVarChar, email)
                    .input('username', sql.NVarChar, name || email.split('@')[0])
                    .query('INSERT INTO Users (Username, Email) OUTPUT INSERTED.UserID VALUES (@username, @email)');
                
                dbUserId = insertResult.recordset[0].UserID;
            }

            // return { jsonBody: { dbUserId } };
            return { jsonBody: { dbUserId: result.recordset[0].UserID } };
        } catch (err) {
            return { status: 500, body: err.message };
        }
    }
});