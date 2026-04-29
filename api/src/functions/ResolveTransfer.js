const { app } = require('@azure/functions');
const sql = require('mssql');

app.http('ResolveTransfer', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Processing POST request for /api/ResolveTransfer');

        const connectionString = process.env.SqlConnectionString;
        if (!connectionString) {
            return { status: 500, body: "Database connection string is missing." };
        }

        try {
            const body = await request.json();
            const { ItemID, Resolution } = body;

            // Ensure we received valid data: Resolution must be exactly 'Accept' or 'Reject'
            if (!ItemID || !['Accept', 'Reject'].includes(Resolution)) {
                return { 
                    status: 400, 
                    body: "Valid ItemID and Resolution ('Accept' or 'Reject') are required." 
                };
            }

            const pool = await sql.connect(connectionString);

            // Transaction: Find the active pending transfer for this item and update both tables
            await pool.request()
                .input('ItemID', sql.Int, ItemID)
                .input('Resolution', sql.NVarChar, Resolution)
                .query(`
                    BEGIN TRY
                        BEGIN TRAN;
                        
                        DECLARE @TransferID INT;
                        DECLARE @ToUserID INT;
                        
                        -- 1. Identify the specific ledger entry that is currently pending
                        SELECT TOP 1 
                            @TransferID = TransferID, 
                            @ToUserID = ToUserID 
                        FROM TransferLedger 
                        WHERE ItemID = @ItemID AND TransferStatus = 'Pending Acceptance'
                        ORDER BY Timestamp DESC;

                        IF @TransferID IS NOT NULL
                        BEGIN
                            IF @Resolution = 'Accept'
                            BEGIN
                                -- Update ledger to Accepted, change item owner, and unlock item
                                UPDATE TransferLedger SET TransferStatus = 'Accepted' WHERE TransferID = @TransferID;
                                UPDATE Items SET CurrentOwnerID = @ToUserID, Status = 'Available' WHERE ItemID = @ItemID;
                            END
                            ELSE IF @Resolution = 'Reject'
                            BEGIN
                                -- Update ledger to Rejected, keep original owner, and unlock item
                                UPDATE TransferLedger SET TransferStatus = 'Rejected' WHERE TransferID = @TransferID;
                                UPDATE Items SET Status = 'Available' WHERE ItemID = @ItemID;
                            END
                        END
                        
                        COMMIT TRAN;
                    END TRY
                    BEGIN CATCH
                        ROLLBACK TRAN;
                        THROW;
                    END CATCH
                `);

            return {
                status: 200,
                jsonBody: { message: `Transfer successfully ${Resolution.toLowerCase()}ed.` }
            };

        } catch (err) {
            context.log(`Transfer resolution error: ${err}`);
            return { status: 500, body: "An error occurred while resolving the transfer." };
        }
    }
});