import streamlit as st
import requests
import json

st.set_page_config(page_title="VietTravel AI Planner", layout="centered")

st.title("🗺️ VietTravel AI Planner")
st.caption("Plan your Vietnam trip with AI-powered suggestions")

# Simple input form
with st.form(key="trip_form"):
    destination = st.text_input("Destination (city or region)", "Hà Nội")
    days = st.slider("Number of days", 1, 7, 2)
    submit = st.form_submit_button("Generate Itinerary")

if submit:
    st.info(f"Generating itinerary for **{destination}** ({days} days)...")
    # Call backend FastAPI endpoint (adjust URL if needed)
    try:
        resp = requests.post(
            "https://api.example.com/plan",  # placeholder URL – replace with your actual endpoint
            json={"destination": destination, "days": days},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        itinerary = data.get("itinerary", [])
        if itinerary:
            for idx, item in enumerate(itinerary, start=1):
                st.markdown(f"**Day {idx}:** {item}")
        else:
            st.warning("No itinerary returned from the server.")
    except Exception as e:
        st.error(f"Error contacting the planning service: {e}")

st.sidebar.header("About")
st.sidebar.info(
    "This demo showcases a Streamlit front‑end that talks to the FastAPI backend of the VietTravel AI planner.\n"
    "Deploy the backend first, then replace the placeholder URL with your live endpoint."
)
