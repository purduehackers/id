import React from "react";

enum AuthState {
    EnterNumber,
    WaitForScan,
    Authorize,
    Done,
}

const Authorize = () => {
    const [passport, setPassport] = React.useState("")
    const [state, setState] = React.useState(AuthState.EnterNumber)
    const [totpNeeded, setTotpNeeded] = React.useState(false)

    React.useEffect(() => {
        if (state != AuthState.WaitForScan) {
            return
        }

        const interval = setInterval(async () => {
            const resp = await fetch(`/api/scan?id=${passport.split('.')[1]}`)
            switch (resp.status) {
                case 200:
                    const { totp_needed } = await resp.json()
                    setTotpNeeded(totp_needed)
                    setState(AuthState.Authorize)
                    break;
                case 201:
                    break;
                default:
                    console.log(`Error on request: ${await resp.text()}`)
            }
        }, 3000)

        return () => {
            clearInterval(interval)
        }
    }, [state]);

    return (
        <div>
            <h1>AUTHORIZATION PAGE</h1>
            {
                state == AuthState.EnterNumber && <div>
                    <p>Enter passport number:</p>
                    <input value={passport} onChange={(ev) => { setPassport(ev.target.value) }}/>
                    <button onClick={(_) => { setState(AuthState.WaitForScan) }} disabled={passport.length === 0 || !/\d+\.\d+/.test(passport)}>Submit</button>
                </div>
            }
            {
                state == AuthState.WaitForScan && <div>
                    <p>WAITING FOR SCAN...</p>
                    <p>Polling once every approximately 3 seconds...</p>
                </div>
            }
        </div>
    );
};

export default Authorize;
