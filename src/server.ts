import express from "express";
import authRouter from "./routes/auth.routes";
import courseRouter from "./routes/course.routes";
import dashboardRouter from "./routes/dashboard.routes"
import sectionRouter from "./routes/section.routes"
import lectureRouter from "./routes/lecture.routes"
import categoryRouter from "./routes/category.routes"
import instructorRouter from "./routes/instructor.routes"
import paymentRouter from "./routes/payment.routes"
const app = express();

app.use(express.json());

app.get("/", (req, res) => {

    res.json({

        message: "LMS Backend Running"

    });

});
app.use("/auth", authRouter);
app.use("/courses",courseRouter);
app.use("/dashboard",dashboardRouter);
app.use("/sections", sectionRouter);
app.use("/lectures", lectureRouter);
app.use("/categories", categoryRouter);
app.use("/instructor", instructorRouter);
app.use("/payment", paymentRouter);

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});