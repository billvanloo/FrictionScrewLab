# 03. Friction and Screw Lab

New tool. Supports unit module 2 (screw jack). Mockup: `mockups/03-friction-screw-lab.html`. Prototype: the screw jack interactive on the unit plan page.

## 1. Purpose

Two linked workspaces. The Ramp lets students find friction coefficients from tilt angles, by simulation or from their own lab measurements. The Screw takes that friction value and shows the torque to raise and lower a load, efficiency, self-locking and stress in the screw. Students see a number they measured flow directly into a machine's behavior.

### Learning targets

Students can:

1. Resolve weight into components along and perpendicular to a ramp.
2. Find static and kinetic friction coefficients from slip angles.
3. Relate a screw thread to a ramp wrapped around a cylinder (lead, mean diameter, lead angle).
4. Compute torque to raise and lower a load, handle force and efficiency.
5. Predict whether a screw is self-locking and explain why.
6. Compute compressive and torsional stress at the screw root.
7. (Extension) Account for thread angle and collar friction.

## 2. Scope

In version 1: Ramp workspace (simulate and measure), Screw workspace (square, Acme, metric trapezoidal), collar friction, back-calculation of friction from a measured handle force, and a link from Ramp to Screw.

Not in version 1: ball screws, buckling of long screws (point to the Truss Stress Visualizer buckling upgrade, file 09), wear life.

## 3. Model and math

### 3.1 Ramp

- Weight components: along the ramp m g sin θ, into the ramp m g cos θ. Normal force N = m g cos θ.
- Static: a resting block starts to slide when tan θ > μ_s. Estimated μ_s = tan θ_slip.
- Kinetic: once sliding, acceleration a = g (sin θ − μ_k cos θ). Steady sliding (a = 0) gives μ_k = tan θ.
- Source: OpenStax College Physics 2e, 5.1 (friction, incline method).
- Measure mode: students type repeated measured angles (up to 20 trials per surface pair). The tool shows each μ = tan θ, the mean, and the spread (minimum to maximum and standard deviation). Values are only good to one or two digits, which OpenStax notes; the help panel says so.

### 3.2 Screw geometry

- Lead l = n · p, for n starts and pitch p (RoyMech).
- Ideal square thread of depth p/2: mean diameter d_m = d − p/2, root diameter d_r = d − p (Shigley). Allow the student to override d_m and d_r with measured values.
- Lead angle λ: tan λ = l / (π d_m) (Shigley chapter 8 slides).
- Thread half-angle α: 0° square, 14.5° Acme, 15° metric trapezoidal (MechanixCalc power screw notes, citing ASME B1.5 and ISO 2901).
- Effective friction μ′ = μ / cos α, which is the μ sec β form (ScienceDirect Topics, power screw; MechanixCalc).

### 3.3 Torque, efficiency, self-locking

- Torque to raise (screw only): T_R = (W d_m / 2) · (l + π μ′ d_m) / (π d_m − μ′ l). For α = 0 this is Shigley eq. 8-1; the general form matches the MechSimulator formula with the thread angle included.
- Torque to lower (screw only): T_L = (W d_m / 2) · (π μ′ d_m − l) / (π d_m + μ′ l). A negative value means the load drives the screw down by itself (overhauls).
- Collar friction torque: T_c = W μ_c d_c / 2, added to both raise and lower totals (RoyMech).
- Efficiency e = W l / (2π T_R,total) (Engineers Edge; MechSimulator).
- Self-locking (thread): π μ′ d_m > l, equivalent to μ′ > tan λ. Report separately whether the total lowering torque including collar is positive. A screw can fail the thread test but still hold because of collar friction (see FS-8).
- Handle force: F = T / R for handle radius R. Frictionless ideal: F_ideal = W l / (2π R) (work in equals work out).
- If π d_m − μ′ l ≤ 0, the raise formula is not defined. Show: "With this much friction on this steep a thread, the screw cannot be turned to lift the load."

### 3.4 Stress at the root

- Compressive: σ = 4W / (π d_r²) (σ = F/A, OpenStax 5.3).
- Torsional shear from the raising torque: τ = 16 T_R / (π d_r³) (same form as shafts, file 01).
- Show both, and a note that a long screw is also a column that designers check for buckling (ScienceDirect Topics, power screw).

### 3.5 Back-calculation

Given measured handle force F_meas at radius R, find μ such that T_R(μ) = F_meas · R, by bisection on μ from 0 to 1. Report μ and the measured efficiency. If no μ in that range fits, say so.

## 4. Inputs and controls

### Ramp

| Input | Unit | Range | Default |
|---|---|---|---|
| Angle θ | degrees | 0 to 60 | 15 |
| Mass | kg | 0.01 to 50 | 1 |
| μ_s, μ_k (simulate mode) | | 0 to 1.5 | 0.36, 0.30 |
| Mystery surface (challenge) | | hidden μ values set by teacher | |
| Measured angles | degrees | list | empty |

### Screw

| Input | Symbol | Unit | Range | Default |
|---|---|---|---|---|
| Load | W | N | 1 to 100,000 | 2000 |
| Major diameter | d | mm | 2 to 200 | 20 |
| Pitch | p | mm | 0.25 to 25 | 4 |
| Starts | n | | 1 to 8 | 1 |
| Thread form | | | Square, Acme, Trapezoidal | Square |
| Thread friction | μ | | 0.01 to 0.5 | 0.15 |
| Use Ramp result | | toggle | | off |
| Collar friction, collar diameter | μ_c, d_c | , mm | 0 to 0.5, 0 to 400 | 0, 0 |
| Handle radius | R | mm | 10 to 2000 | 300 |
| Measured handle force | F_meas | N | optional | blank |

## 5. Interactions

1. Ramp, simulate: drag the ramp angle. The block stays until tan θ > μ_s, then slides with the computed acceleration. A force diagram shows weight, its two components, normal force and friction, labeled with values.
2. Ramp, measure: type measured angles. A dot plot shows each μ and the mean. Press "Send μ to Screw" to copy the mean kinetic value into the Screw workspace.
3. Screw: press and hold Turn (or arrow up) to raise, arrow down to lower, Let go to release. On release, a self-locking screw holds; an overhauling screw drops with increasing speed. The unrolled-thread triangle beside the jack shows λ, and a dashed line at the friction angle φ = arctan μ′.
4. Changing thread form redraws the thread profile and updates μ′.
5. Measured force: entering F_meas shows the back-calculated μ and efficiency beside the predicted values.

## 6. Outputs

- Ramp: θ, force components, slides or holds, acceleration, measured μ table and statistics.
- Screw: l, d_m, d_r, λ, φ, μ′, T_R (screw, collar, total), T_L (screw, collar, total), F and F_ideal, e, self-locking by thread, holds with collar, σ and τ at root, back-calculated μ.
- Predict first targets: μ from a given slip angle, T_R, F, e, self-locking yes or no.

## 7. Test cases

| ID | Inputs | Expected |
|---|---|---|
| FS-1 | Ramp, μ_s = 0.36 | Block starts to slide above 19.8° |
| FS-2 | Ramp, θ = 30°, μ_k = 0.30, already sliding | a = 2.36 m/s² |
| FS-3 | Measured angles 20°, 21°, 19° | μ values 0.364, 0.384, 0.344. Mean 0.364 |
| FS-4 | Screw. W = 2000 N, d = 20 mm, p = 4 mm, n = 1, square, μ = 0.15, no collar, R = 300 mm | l = 4 mm, d_m = 18 mm, d_r = 16 mm, λ = 4.05°, φ = 8.53°. T_R = 4.02 N·m. T_L = 1.41 N·m. F = 13.4 N, F_ideal = 4.24 N. e = 31.7%. Self-locking yes. σ = 9.95 MPa. τ = 4.99 MPa |
| FS-5 | FS-4 with Acme thread | μ′ = 0.155. T_R = 4.11 N·m. T_L = 1.50 N·m. e = 31.0%. Self-locking yes |
| FS-6 | FS-4 with n = 4, μ = 0.05 | l = 16 mm. T_R = 6.08 N·m. T_L = −4.13 N·m (overhauls). e = 83.8%. Self-locking no. On release the load drops |
| FS-7 | W = 6400 N, d = 32 mm, p = 4 mm, n = 2, square, μ = 0.08, μ_c = 0.08, d_c = 40 mm | d_m = 30 mm, l = 8 mm. T_R screw = 15.94 N·m, collar = 10.24 N·m, total 26.18 N·m. T_L screw = −0.466 N·m, total 9.77 N·m. e = 31.1% |
| FS-8 | Same as FS-7 | Self-locking by thread: no. Holds with collar: yes. Both statements shown |
| FS-9 | FS-4 with measured F_meas = 20 N | Back-calculated μ = 0.257. Measured e = 21.2% |
| FS-10 | d = 10 mm, p = 8 mm, n = 4, μ = 0.5 | π d_m − μ l = 18.85 − 16 = 2.85 > 0, defined. Then set μ = 0.6: 18.85 − 19.2 < 0, "cannot be turned" message |
| FS-11 | p ≥ d (for example d = 4, p = 5) | Field message: "Pitch must be smaller than the diameter." |
| FS-12 | Ramp to Screw link: mean μ 0.364 sent | Screw μ field shows 0.364 and the label "from Ramp measurements" |

FS-7 reproduces the structure of Shigley's square-thread example with a double thread and collar. Expected values here were computed from the formulas in section 3; confirm against your edition of Shigley if you use it in class.

## 8. Acceptance criteria

- [ ] All test cases pass in Node and in the interface.
- [ ] The release animation matches the self-locking result every time (hold if total lowering torque ≥ 0, drop if < 0).
- [ ] The unrolled-thread triangle is drawn to true angle, not exaggerated, with a zoom control for small angles.
- [ ] Show the working includes the tangent-sum form T_R = (W d_m/2) tan(φ + λ) as a second line for square threads, with matching numbers.

## 9. Sources

- OpenStax College Physics 2e, 5.1 Friction: https://openstax.org/books/college-physics-2e/pages/5-1-friction
- OpenStax College Physics 2e, 5.3 Stress and strain: https://openstax.org/books/college-physics-2e/pages/5-3-elasticity-stress-and-strain
- Shigley's Mechanical Engineering Design, ch. 8, lecture slides: https://web.itu.edu.tr/~halit/Makel/Ch_8_slides_m.pdf
- RoyMech, power screws: https://www.roymech.co.uk/Useful_Tables/Cams_Springs/Power_Screws_1.html
- Engineers Edge, power screws: https://www.engineersedge.com/mechanics_machines/power_screws_design_13982.htm
- MechSimulator, power screw: https://mechsimulator.com/tools/power-screw/
- MechanixCalc, power screw calculator notes (thread half-angles, μ/cos α): https://www.mechanixcalc.com/powerscrew
- ScienceDirect Topics, power screw: https://www.sciencedirect.com/topics/engineering/power-screw
