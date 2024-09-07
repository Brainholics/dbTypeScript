import express from 'express';
import enrichminionUserRoutes from './enrichminion/user';
import enrichminionAdminRoutes from './enrichminion/admin';
import enrichminionLogRoutes from './enrichminion/logs';
import enrichminionAPIRoutes from './enrichminion/apikey';
import podcastUserRoutes from './podcast/user';
import podcastAdminRoutes from './podcast/admin';
import podcastAPIRoutes from './podcast/apikey';
import maindbRoutes from './maindb/enrichminion/index';


const app = express.Router();

// Enrichminion routes
app.use('/enrichminion/user', enrichminionUserRoutes);
app.use('/enrichminion/admin', enrichminionAdminRoutes);
app.use('/enrichminion/logs', enrichminionLogRoutes);
app.use('/enrichminion/v1', enrichminionAPIRoutes);



// Podcast routes
app.use('/podcast/user', podcastUserRoutes);
app.use('/podcast/admin', podcastAdminRoutes);
app.use('/podcast/v1', podcastAPIRoutes);


// maindb routes
app.use('/maindb', maindbRoutes);



export default app;
