import express from 'express';
// import enrichminionUserRoutes from './enrichminion/user';
// import enrichminionAdminRoutes from './enrichminion/admin';
// import enrichminionLogRoutes from './enrichminion/logs';
// import enrichminionAPIRoutes from './enrichminion/apikey';
import podcastUserRoutes from './podcast/user';
import podcastAdminRoutes from './podcast/admin';
import podcastAPIRoutes from './podcast/apikey';
// import verifyEmailServiceRoutes from "./verifyEmail/service";
// import verifyEmailAdminRoutes from "./verifyEmail/admin";
// import verifyEmailLogRoutes from "./verifyEmail/logs";
// import verifyEmailAPIRoutes from "./verifyEmail/apikey";
import minionLabsUserRoutes from './minionlabs/user';
import minionLabsAdminRoutes from './minionlabs/admin';
import minionLabsEnrichminionLogs from './minionlabs/enrichminion';
import minionLabsVerifyEmailLogs from "./minionlabs/verifyEmailLogs";
import minionLabsServices from "./minionlabs/services";
import minionLabsVerifyEmailAPI from "./minionlabs/verifyEmaillapi";

const app = express.Router();

// // Enrichminion routes
// app.use('/enrichminion/user', enrichminionUserRoutes);
// app.use('/enrichminion/admin', enrichminionAdminRoutes);
// app.use('/enrichminion/logs', enrichminionLogRoutes);
// app.use('/enrichminion/v1', enrichminionAPIRoutes);

app.use('/minionlabs/user', minionLabsUserRoutes);
app.use("/minionlabs/admin",minionLabsAdminRoutes);
app.use("/minionlabs/enrichminion/logs",minionLabsEnrichminionLogs);
app.use("/minionLabs/verifyEmail/logs",minionLabsVerifyEmailLogs);
app.use("/minionLabs/verifyEmail/v1",minionLabsVerifyEmailAPI);
app.use("/minionLabs/services",minionLabsServices);


// Podcast routes
app.use('/podcast/user', podcastUserRoutes);
app.use('/podcast/admin', podcastAdminRoutes);
app.use('/podcast/v1', podcastAPIRoutes);


// maindb routes
// app.use('/maindb', maindbRoutes);

// app.use("/verifyEmail/service", verifyEmailServiceRoutes);
// app.use("/verifyEmail/admin", verifyEmailAdminRoutes);
// app.use("/verifyEmail/logs", verifyEmailLogRoutes);
// app.use("/verifyEmail/v1", verifyEmailAPIRoutes);



export default app;
