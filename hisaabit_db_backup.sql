--
-- PostgreSQL database dump
--

\restrict u6ylsbJyz1HkMLW5eYbXyb5YktwO854g9ozBlHLxCI0J1EgWcq30FdhZfwohimx

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: budget_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.budget_settings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    daily_limit integer,
    weekly_limit integer
);


ALTER TABLE public.budget_settings OWNER TO postgres;

--
-- Name: budgets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.budgets (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    category text NOT NULL,
    "limit" integer NOT NULL,
    month text NOT NULL
);


ALTER TABLE public.budgets OWNER TO postgres;

--
-- Name: expenses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expenses (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    amount integer NOT NULL,
    category text NOT NULL,
    note text DEFAULT ''::text,
    date text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.expenses OWNER TO postgres;

--
-- Name: monthly_budgets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.monthly_budgets (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    month text NOT NULL,
    total_limit integer NOT NULL
);


ALTER TABLE public.monthly_budgets OWNER TO postgres;

--
-- Name: session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    name text NOT NULL,
    reset_token text,
    reset_token_expiry timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    email_confirmed boolean DEFAULT false NOT NULL,
    confirmation_token text,
    subscription_plan text DEFAULT 'free'::text NOT NULL,
    voice_usage_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: budget_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.budget_settings (id, user_id, daily_limit, weekly_limit) FROM stdin;
9f3b1955-530e-4a5d-b8f4-8b19107bc7a0	6daaa172-834f-42de-932a-8e24b7e67590	\N	10000
\.


--
-- Data for Name: budgets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.budgets (id, user_id, category, "limit", month) FROM stdin;
\.


--
-- Data for Name: expenses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.expenses (id, user_id, amount, category, note, date, created_at) FROM stdin;
2a840be8-5546-4ee0-9a1b-a0bf786b9bb3	6daaa172-834f-42de-932a-8e24b7e67590	2000	general	Cash	2026-02-23T01:00:43.276Z	2026-02-23 01:00:45.559531
723d6216-30b8-447a-957d-79bd8ff3432f	6daaa172-834f-42de-932a-8e24b7e67590	350	kiryana	Milk	2026-02-23T01:00:57.891Z	2026-02-23 01:00:59.160867
e4c9bfe0-da57-4198-9500-23f08731d50d	6daaa172-834f-42de-932a-8e24b7e67590	2000	general	Easypaisa	2026-02-23T05:17:50.075Z	2026-02-23 05:17:50.409243
041f8f56-2224-43fe-95e7-7906ff4ffead	6daaa172-834f-42de-932a-8e24b7e67590	25000	general	Sent money to Tabish Bhai	2026-02-10T17:21:55.685Z	2026-02-10 17:21:56.728581
0c9b0e21-b49a-4f2f-9491-e22d7f3eea5d	6daaa172-834f-42de-932a-8e24b7e67590	2300	paniBill	Paid water bill	2026-02-10T17:21:58.527Z	2026-02-10 17:22:00.198608
a46401fd-0739-40c1-8a71-5dac1f8b27b9	6daaa172-834f-42de-932a-8e24b7e67590	5500	bijliBill	Paid electricity bill	2026-02-10T17:22:00.333Z	2026-02-10 17:22:02.181492
e861c4c6-94df-4c20-b2d9-5985257e5fbb	6daaa172-834f-42de-932a-8e24b7e67590	4720	general	Amount given to Tauseef	2026-02-10T17:24:45.314Z	2026-02-10 17:24:53.902968
2174c8b5-2db8-43b4-987c-0b16051057f3	6daaa172-834f-42de-932a-8e24b7e67590	1700	chaiNashta	Sent money to Mohsin Bhai	2026-02-10T17:21:56.855Z	2026-02-10 17:21:58.381108
bf59b014-758b-41f2-b3dc-88bda38276dc	6daaa172-834f-42de-932a-8e24b7e67590	2000	general	Money sent to easypaisa account	2026-02-11T10:23:42.307Z	2026-02-11 10:23:42.531755
8792db2a-1cf6-4611-b93a-9bae2daec45e	6daaa172-834f-42de-932a-8e24b7e67590	500	chaiNashta	Food today	2026-02-11T10:23:42.665Z	2026-02-11 10:23:42.861447
c498ddef-ba93-4696-be6a-551493c663df	6daaa172-834f-42de-932a-8e24b7e67590	12000	kiryana	Grocery shopping	2026-02-11T17:06:13.578Z	2026-02-11 17:06:14.615701
d54e8538-7df1-4a3c-ae91-24002ba970a3	6daaa172-834f-42de-932a-8e24b7e67590	1000	transport	Transport expenses	2026-02-11T17:06:14.740Z	2026-02-11 17:06:14.887107
4a54793b-3fc6-44bb-8f8d-795f2de7411e	6daaa172-834f-42de-932a-8e24b7e67590	5000	general	Money given to mother for household expenses	2026-02-12T12:49:28.740Z	2026-02-12 12:49:28.95288
500428f2-14f9-4331-9580-1fc50a0f57d6	6daaa172-834f-42de-932a-8e24b7e67590	10000	general	Money given to mother for personal expenses	2026-02-12T12:49:29.072Z	2026-02-12 12:49:29.23118
554f4dc3-48e6-4b19-8619-02685f474dec	6daaa172-834f-42de-932a-8e24b7e67590	50000	rent		2026-02-13T06:09:03.469Z	2026-02-13 06:09:04.510029
dbade26c-a063-498f-ad54-a4fac51c5d15	6daaa172-834f-42de-932a-8e24b7e67590	5000	general	Easypaisa account	2026-02-13T18:56:36.233Z	2026-02-13 18:56:37.7246
09a1d49f-a1ad-41ac-b972-34b1cbc78f2f	6daaa172-834f-42de-932a-8e24b7e67590	1000	general	Spent on EasyPaisa	2026-02-14T07:58:57.300Z	2026-02-14 07:58:57.474486
941e4258-4ceb-4307-a72d-e03bcd1d9026	6daaa172-834f-42de-932a-8e24b7e67590	1000	medical		2026-02-25T04:25:10.245Z	2026-02-25 04:25:10.565462
db9302d6-8b8b-4536-a619-82d037031fbd	6daaa172-834f-42de-932a-8e24b7e67590	422	general	Anum headphones	2026-02-16T03:45:20.233Z	2026-02-16 03:45:21.526117
56f2c5ca-6421-482e-9b37-d0b2bf30596e	6daaa172-834f-42de-932a-8e24b7e67590	3858	general	Easypaisa	2026-02-16T03:47:27.670Z	2026-02-16 03:47:29.198953
4e61f132-7356-47ab-8052-9f60a38a77ae	6daaa172-834f-42de-932a-8e24b7e67590	730	chaiNashta		2026-02-17T17:58:06.760Z	2026-02-17 17:58:07.996969
5e8129e7-b991-40b4-b622-e1836eb30c08	6daaa172-834f-42de-932a-8e24b7e67590	800	chaiNashta		2026-02-16T17:58:26.457Z	2026-02-17 17:58:28.197324
2b428263-633b-4ab3-a0de-767deff1b0ed	6daaa172-834f-42de-932a-8e24b7e67590	5000	general	Money sent to mother for expenses	2026-02-18T08:18:05.484Z	2026-02-18 08:18:05.719461
58e4f08c-a7d1-41ce-b104-c16da2b1cf73	6daaa172-834f-42de-932a-8e24b7e67590	5000	general	Sent to easypaisa account	2026-02-19T05:04:17.048Z	2026-02-19 05:04:17.216294
eec15ea7-9d22-4fe1-8a7c-e8356558fe52	6daaa172-834f-42de-932a-8e24b7e67590	2250	paniBill		2026-02-19T05:04:29.963Z	2026-02-19 05:04:30.127095
732d730d-9749-470c-b015-de55f1b4a4a6	6daaa172-834f-42de-932a-8e24b7e67590	300	chaiNashta		2026-02-19T10:14:11.071Z	2026-02-19 10:13:56.16127
b80f52c0-18db-4bb9-9067-1a4b421e02cf	6daaa172-834f-42de-932a-8e24b7e67590	2000	general	Cash for kharcha	2026-02-19T05:44:57.617Z	2026-02-21 05:44:59.414346
d4885be8-8071-4d17-80ae-688148410465	6daaa172-834f-42de-932a-8e24b7e67590	3300	general	Hissabit domain	2026-02-20T05:47:48.200Z	2026-02-19 10:13:06.164713
5a69b0b7-07b1-4ff1-b167-1e2ca877ca8b	6daaa172-834f-42de-932a-8e24b7e67590	3500	general	Spent on trimmer	2026-02-21T13:19:08.918Z	2026-02-21 13:19:09.439559
0942c729-0bff-4f20-aa7f-175ffecdf2b4	6daaa172-834f-42de-932a-8e24b7e67590	4000	chaiNashta	Iftaar with ami	2026-02-24T04:25:20.450Z	2026-02-25 04:24:57.219484
cceaa040-84e6-40fd-9cff-a4b9c09db84c	6daaa172-834f-42de-932a-8e24b7e67590	2000	general	Easypaisa	2026-02-25T04:25:42.253Z	2026-02-25 04:25:43.202757
4aecb030-abd8-4fed-b2de-9ddd631ea181	6daaa172-834f-42de-932a-8e24b7e67590	5000	general	Weekly kharcha sent to ami	2026-02-26T04:35:59.544Z	2026-02-26 04:36:03.417359
0354c8ef-103d-4b0b-ad46-7d74230a4e4d	6daaa172-834f-42de-932a-8e24b7e67590	1000	chaiNashta		2026-03-18T15:02:50.155Z	2026-03-18 15:02:50.286625
3617ef6f-7276-4015-9e7f-d81996b77eec	6daaa172-834f-42de-932a-8e24b7e67590	200	chaiNashta	Food with snacks	2026-03-18T15:04:52.902Z	2026-03-18 15:04:53.047066
\.


--
-- Data for Name: monthly_budgets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.monthly_budgets (id, user_id, month, total_limit) FROM stdin;
44430196-6d66-4fe9-9f8c-9e5ca2eadf95	6daaa172-834f-42de-932a-8e24b7e67590	2026-02	185000
7bd24a8e-12dd-41ef-ab54-367727e1487e	6daaa172-834f-42de-932a-8e24b7e67590	2026-03	50000
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.session (sid, sess, expire) FROM stdin;
mzkwVPjOsoEUXUhxapqjzjzSxAUWyrRU	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-17T14:59:14.447Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":"6daaa172-834f-42de-932a-8e24b7e67590"}	2026-05-04 15:41:18
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password, name, reset_token, reset_token_expiry, created_at, email_confirmed, confirmation_token, subscription_plan, voice_usage_count) FROM stdin;
1f17f133-fdc5-462a-9412-bb8381bcc47d	test+3jiknn@test.com	$2b$10$GqZBswM4mxE2UwtTzeegVONcTNFXTapSSDefDEzbIQcym4361ytVO	Playwright Test User	\N	\N	2026-02-14 09:00:36.305227	f	66363cf4aeea20444bb1a5e7d452646540a6be2c50fb09d1a93510d9bc2d5b85	free	0
6daaa172-834f-42de-932a-8e24b7e67590	moeezakhtar01@gmail.com	$2b$10$LlgGW3M/pxQm5Zcrc87do.BVC26Im5piQ.CoL6Xn3M5sKL7pdCFQ2	Moeez Test	\N	\N	2026-02-09 12:43:02.910326	t	\N	free	2
\.


--
-- Name: budget_settings budget_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budget_settings
    ADD CONSTRAINT budget_settings_pkey PRIMARY KEY (id);


--
-- Name: budget_settings budget_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budget_settings
    ADD CONSTRAINT budget_settings_user_id_key UNIQUE (user_id);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: monthly_budgets monthly_budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_budgets
    ADD CONSTRAINT monthly_budgets_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: budget_settings budget_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budget_settings
    ADD CONSTRAINT budget_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: budgets budgets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: expenses expenses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: monthly_budgets monthly_budgets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_budgets
    ADD CONSTRAINT monthly_budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict u6ylsbJyz1HkMLW5eYbXyb5YktwO854g9ozBlHLxCI0J1EgWcq30FdhZfwohimx

