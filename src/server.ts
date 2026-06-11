import express from "express";
import authRouter from "./routes/auth.routes";
import courseRouter from "./routes/course.routes";
const app = express();

app.use(express.json());

app.get("/", (req, res) => {

    res.json({

        message: "LMS Backend Running"

    });

});
app.use("/auth", authRouter);
app.use("/courses",courseRouter);

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});