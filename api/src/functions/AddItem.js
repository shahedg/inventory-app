const { app } = require('@azure/functions');
const sql = require('mssql');

app.http('AddItem', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Processing POST request for /api/AddItem');

        // 1. Check for the database connection string
        const connectionString = process.env.SqlConnectionString;
        if (!connectionString) {
            context.log('Error: SqlConnectionString is missing.');
            return { status: 500, body: "Database connection string is not configured." };
        }

        try {
            // 2. Parse the incoming JSON data from the React frontend
            const body = await request.json();
            const { ItemName, Description, ImageURL, CurrentOwnerID } = body;

            // 3. Basic Validation: Ensure the required fields were provided
            if (!ItemName || !CurrentOwnerID) {
                return { 
                    status: 400, 
                    body: "ItemName and CurrentOwnerID are required fields." 
                };
            }

            // 4. Connect to the Azure SQL Database
            const pool = await sql.connect(connectionString);

            // 5. Insert the new item securely using parameterized inputs
            const result = await pool.request()
                .input('ItemName', sql.NVarChar, ItemName)
                .input('Description', sql.NVarChar, Description || '')
                .input('ImageURL', sql.NVarChar, ImageURL || 'https://via.placeholder.com/150')
                .input('CurrentOwnerID', sql.Int, CurrentOwnerID)
                .query(`
                    INSERT INTO Items (ItemName, Description, ImageURL, CurrentOwnerID, Status)
                    OUTPUT INSERTED.ItemID
                    VALUES (@ItemName, @Description, @ImageURL, @CurrentOwnerID, 'Available')
                `);

            // 6. Return a success message and the ID of the newly created tool
            return {
                status: 201, // HTTP status code for "Created"
                jsonBody: { 
                    message: "Tool added successfully!", 
                    newItemID: result.recordset[0].ItemID 
                }
            };

        } catch (err) {
            context.log(`Database error: ${err}`);
            return {
                status: 500,
                body: "An error occurred while adding the item to the database."
            };
        }
    }
});