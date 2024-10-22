import express from "express";
import userAuth from "../../middleware/enrichminion/supabaseAuth";
import {getUser} from "../../db/enrichminion/user";
import { createInvoice } from "../../utils/createInvoice";
import { uploadToS3 } from "../../utils/uploadtoS3";
import s3 from "../../db/verifyEmail/s3";
import { createInvoiceEntry, getInvoiceByBillingID, getInvoicesByUserID } from "../../db/verifyEmail/billing";

const app = express.Router();

app.post("/createInvoice", userAuth, async (req, res) => { 
    try{
        const userID = (req as any).user.id;

        const user = await getUser(userID);
        if(!user){
            res.status(404).json({ message: "User not found" });
            return;
        }

        const {quantity,unitCost,currency,amountPaid,from,creditsRequested} = req.body;

        // Create invoice here
        const invoiceData = await createInvoice(from,user.name,quantity,unitCost,currency,amountPaid);

        if(!invoiceData){
            res.status(500).json({ message: "Invoice not created" });
            return;
        }
        const time = new Date().getTime();
        const fileName = `${from}-${userID}-${time}.pdf`;
        // const uploadedInvoice = await uploadToS3("invoices",fileName,invoiceData.toString(),"public-read","application/pdf");
        const param = {
            Bucket: "invoices",
            Key: fileName,
            Body: invoiceData,
            ACL: "public-read",
            ContentType: "application/pdf"
        }

        const uploadedInvoice = await s3.upload(param).promise();
        if(!uploadedInvoice){
            res.status(500).json({ message: "Invoice not uploaded" });
            return;
        }

        const invoiceLog = await createInvoiceEntry(userID,uploadedInvoice.ETag.replace(/"/g,''),uploadedInvoice.Location,from, creditsRequested)
        if(!invoiceLog){
            res.status(500).json({ message: "Invoice not logged" });
            return;
        }

        res.status(200).json({ message: "Invoice created" , invoice: uploadedInvoice.Location});
        
    }catch(e: any){
        res.status(500).json({ message: e.message });
    }
});

app.get("/getBillsByUser", userAuth, async (req, res) => {
    try{
        const userID = (req as any).user.id;

        const bills = await getInvoicesByUserID(userID);
        if(!bills){
            res.status(404).json({ message: "Bills not found" });
            return;
        }

        res.status(200).json({ bills });
    }catch(e: any){
        res.status(500).json({ message: e.message });
    }
});

app.post("/getBill", userAuth, async (req, res) => {
    try{
        const {billingID} = req.body;

        const bill = await getInvoiceByBillingID(billingID);
        if(!bill){
            res.status(404).json({ message: "Bill not found" });
            return;
        }

        res.status(200).json({ bill });
    }catch(e: any){
        res.status(500).json({ message: e.message });
    }
})


export default app; 