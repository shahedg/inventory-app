const { app } = require('@azure/functions');
const sql = require('mssql');

app.http('InitiateTransfer', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Processing POST request for /api/InitiateTransfer');

        const connectionString = process.env.SqlConnectionString;
        if (!connectionString) {
            return { status: 500, body: "Database connection string is missing." };
        }

        try {
            const body = await request.json();
            const { ItemID, ToUserID, InitiatorID } = body;

            if (!ItemID || !ToUserID || !InitiatorID) {
                return { status: 400, body: "ItemID, ToUserID, and InitiatorID are required." };
            }

            const pool = await sql.connect(connectionString);

            // We use a SQL Transaction (BEGIN TRAN) to ensure that if the ledger updates, 
            // the item status also updates. If one fails, both fail (rollback).
            await pool.request()
                .input('ItemID', sql.Int, ItemID)
                .input('ToUserID', sql.Int, ToUserID)
                .input('InitiatorID', sql.Int, InitiatorID)
                .query(`
                    BEGIN TRY
                        BEGIN TRAN;
                        
                        -- 1. Find the current owner
                        DECLARE @CurrentOwner INT;
                        SELECT @CurrentOwner = CurrentOwnerID FROM Items WHERE ItemID = @ItemID;

                        -- 2. Create the Audit Trail entry
                        INSERT INTO TransferLedger (ItemID, InitiatorID, FromUserID, ToUserID, TransferStatus)
                        VALUES (@ItemID, @InitiatorID, @CurrentOwner, @ToUserID, 'Pending Acceptance');

                        -- 3. Update the item's status so it can't be transferred again
                        UPDATE Items 
                        SET Status = 'Pending Transfer' 
                        WHERE ItemID = @ItemID;

                        COMMIT TRAN;
                    END TRY
                    BEGIN CATCH
                        ROLLBACK TRAN;
                        THROW;
                    END CATCH
                `);

            return {
                status: 200,
                jsonBody: { message: "Transfer initiated and is pending acceptance." }
            };

        } catch (err) {
            context.log(`Transfer error: ${err}`);
            return { status: 500, body: "An error occurred while initiating the transfer." };
        }
    }
});