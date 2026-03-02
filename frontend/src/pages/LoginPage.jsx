import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, CardContent, Container, TextField, Typography, InputAdornment } from "@mui/material";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import { api } from "../api/client";
import "./LoginPage.css";

export default function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErrMsg("");
    setLoading(true);
    try {
      const response = await api.post("/api/auth/login", { email, password });
      console.log(response.data);
      nav("/users");
    } catch (err) {
      setErrMsg(err?.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="loginPage">
      <Container maxWidth="md">
        <Typography className="loginPage__title" align="center">
          Task Management System
        </Typography>

        <div className="loginPage__cardWrap">
          <Card className="loginPage__card">
            <CardContent className="loginPage__cardContent">
              {errMsg ? (
                <Alert severity="error" className="loginPage__alert">
                  {errMsg}
                </Alert>
              ) : null}

              <form onSubmit={onSubmit}>
                <TextField
                  fullWidth
                  label="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  margin="normal"
                  autoComplete="email"
                  slotProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonOutlineRoundedIcon />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  margin="normal"
                  autoComplete="current-password"
                  slotProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon />
                      </InputAdornment>
                    ),
                  }}
                />

                <div className="loginPage__btnRow">
                  <Button type="submit" variant="contained" startIcon={<LoginRoundedIcon />} disabled={loading} className="loginPage__btn">
                    Login
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </Container>
    </div>
  );
}
