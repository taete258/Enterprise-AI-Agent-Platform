from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/mock", tags=["mock"])


@router.get("/weather")
def mock_weather(city: str = Query(..., description="The city to fetch weather for")):
    """Mock weather service."""
    # Clean the city name
    city_name = city.strip().title()
    return {
        "city": city_name,
        "temperature": 31.5 if "bangkok" in city.lower() else 18.0,
        "condition": "Sunny" if "bangkok" in city.lower() else "Rainy",
        "humidity": "60%",
        "forecast": f"Mostly sunny in {city_name} with occasional clouds."
    }


@router.get("/hr/leaves")
def mock_hr_leaves(email: str = Query(..., description="Employee email")):
    """Mock HR leave service."""
    email_lower = email.strip().lower()
    return {
        "email": email_lower,
        "leave_balance": 14,
        "sick_leave_balance": 6,
        "status": "Active",
        "department": "Engineering"
    }
