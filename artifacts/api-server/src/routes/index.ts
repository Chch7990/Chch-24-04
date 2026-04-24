import { Router, type IRouter } from "express";
import healthRouter from "./health";
import otpRouter from "./otp";
import usersRouter from "./users";
import pdRouter from "./pd";
import lucRouter from "./luc";

const router: IRouter = Router();

router.use(healthRouter);
router.use(otpRouter);
router.use(usersRouter);
router.use(pdRouter);
router.use(lucRouter);

export default router;
