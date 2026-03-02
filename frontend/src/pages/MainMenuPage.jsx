import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Container, Paper, Typography } from "@mui/material";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import "./MainMenuPage.css";

export default function MainMenuPage() {
  const nav = useNavigate();

  return (
    <Container maxWidth="md">
      <Paper className="menuCard">
        <Typography className="menuCard__title">Main Menu</Typography>
        <Typography className="menuCard__sub">Select a module to continue.</Typography>

        <div className="menuCard__actions">
          <Button variant="contained" size="large" startIcon={<PeopleAltRoundedIcon />} onClick={() => nav("/admin/users")} className="menuCard__btn">
            User Management
          </Button>
        </div>
      </Paper>
    </Container>
  );
}
