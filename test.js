require("dotenv").config();


async function test(email) {
    console.log(process.env.OutlookEndpoint)
    const response = await fetch(process.env.OutlookEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            email: email
        })
    })

    if (!response.ok) {
        // const pendingEmails = [...restEmails, ...googleWorkspaceEmails];
        // const updatedLog = await updateLog(logID, "failed at outlook server", ({
        //     apicode: 2,
        //     emails: pendingEmails.map((email) => email.email)
        // } as BreakPoint))
        // if (!updatedLog) {
        //     res.status(400).json({ message: "Failed to update log in case of outlook server failure" });
        //     return;
        // }
        console.log("bdsahjbs")
        // res.status(400).json({ message: "Failed to send emails to outlook server" });
        return;
    }

    const data = await response.json();

    console.log(data['Email-status']);
}

test("devansh92cseb21@bpitindia.edu.in")