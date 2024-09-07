# Search Leads Backend

## Dependencies

- Prisma
- Supabase
- Node.js
- TypeScript
- Express

## How to run

1. Clone the repository
2. Run `npm install`
3. Run `npm run dev`
4. test the API using Postman or any other API testing tool by hitting the endpoint `http://localhost:5050/health`

## API Endpoints

### User

- GET `/health` - Check if the API is running
- POST `/api/user/register` - Register a new user
- GET `/api/user/getUser` - Get a user's details 
- POST `/api/user/addCredits` - add Credits to a user's account
- GET `/api/user/getCredits` - Get a user's credits
- POST `/api/user/searchlead` - search for leads
- GET `/api/user/getCost` - Get cost per leads

### Logs

- GET `/api/logs/getUserLogs` - Get specific user's logs
- GET `/api/logs/getOneLogs` - Get one logs
- POST `/api/logs/checkLeadStatus`, - Check lead status

### Admin

- POST `/api/admin/login` - Admin login
- GET `/api/admin/getPrice` - Get price per 1000 leads
- POST `/api/admin/changePrice` - Change price
- POST `/api/admin/changeAutomationLink` - Change automation link
- POST `/api/admin/changeStatusLink` - Change automation status
- POST `/api/admin/changeDNS` - Change DNS
- GET `/api/admin/getAllUsers` - Get all users
- GET `/api/admin/getAllApikeys` - Get all api keys
- POST `/api/admin/generateAPIkey` - generates api key
- POST `/api/admin/getAPIkey` - get api key
- POST `/api/admin/revokeAPIkey` - delete api key
- POST `/api/admin/updateCredits` - updates user credits
- GET `/api/admin/getUser` - Gets user
- GET `/api/admin/getAllLogsById` - Get all  logs by id
- GET `/api/admin/getAllLogs` - Get all logs

#### API

- POST `\api\v1\searchLeads` - Search for leads
- POST `\api\v1\checkleadStatus` - Check lead status
