# 2 Memory models and state of the art

In this chapter, we first introduce a framework for defining and developing memory models in Section 2.1, then we discuss some of their limitations in Section 2.2, and finally, we explore the state of the art in Section 2.3.

## 2.1. Memory models

In the context of spaced repetition systems, a memory model predicts how likely the student is to remember a card given the review history and the time elapsed since the last review.

Let \( Y \) be a binary random variable representing a review rating, \( Y=1 \) in the case of recall, and \( Y=0 \) in the case of forgetting. We want to predict \( Y \) given additional information:

- **Card and Student**: Let \( \mathcal{C} \) be a set of cards and \( \mathcal{S} \) a set of students. Let \( C \in \mathcal{C} \) and \( S \in \mathcal{S} \) be categorical random variables that represent, respectively, the card under review and the student reviewing it.
- **Review History**: We define as review history of length \( K \) an ordered sequence of reviews \( R^{(1)}, \ldots, R^{(K)} \) where \( R^{(i)}=\left(\Delta^{(i)}, Y^{(i)}\right) \in \mathbb{R}^{+} \times \{0,1\} \) for all \( i \). Here \( \Delta^{(i)} \) is a random variable representing the time elapsed between reviews \( i \) and \( i-1 \) for \( i>1 \), or the time since the card was introduced to the student for \( i=1 \) (time is expressed in days). \( Y^{(i)} \) is a binary random variable for the review rating.
- **Time Elapsed**: Let \( \Delta \in \mathbb{R}^{+} \) be a random variable expressing in days the time elapsed since the last review of the history, or, if the history is empty, since the student was introduced the card. We observe \( \Delta \) before making a prediction for the target rating \( Y \), therefore we include it as a predictor.

For convenience, we denote the random input vector by \( X=\left(C, S,\left(R^{(1)}, \ldots, R^{(K)}\right), \Delta\right) \). We seek a memory model, a function \( p\_{\theta}(X) \) with parameters \( \theta \) such that

\[
\mathbb{P}(Y=1 \mid X=x)=p\_{\theta}(x)
\]

We call retrievability the output probability of recall \( p*{\theta}(x) \). We can highlight the dependence of retrievability on the elapsed time \( \delta>0 \). For fixed card \( c \), student \( s \) and review history \( \left(r^{(1)}, \ldots, r^{(k)}\right), p*{\theta}(\delta)=p\_{\theta}\left(c, s,\left(r^{(1)}, \ldots, r^{(k)}\right), \delta\right) \) is a forgetting curve. The now presented framework is similar to the one in Section 1.2.2, the main addition is that the forgetting curve now accounts for the review history.

Our goal is to find an approximation \( \hat{p}=p*{\hat{\theta}} \) given a previously collected review dataset \( \mathcal{D}=\left\{\left(r*{c s}^{(1)}, \ldots, r*{c s}^{\left(k*{c s}\right)}\right)\right\}_{c \in \mathcal{C}, s \in \mathcal{S}} \) with \( r_{c s}^{(i)}=\left(\delta*{c s}^{(i)}, y*{c s}^{(i)}\right) \). Each card-student pair identifies an independent review history of length \( k\_{c s} \): all reviews on the same card \( c \) by the student \( s \). Given a loss function \( \ell:\{0,1\} \times \{0,1\} \rightarrow \mathbb{R}^{+} \) to penalize prediction errors, we compute \( \hat{\theta} \) as

\[
\hat{\theta}=\underset{\theta}{\operatorname{argmin}} \sum*{c, s} \sum*{k=1}^{k*{c s}} \ell\left(y*{c s}^{(k)}, p*{\theta}\left(c, s,\left(r*{c s}^{(1)}, \ldots, r*{c s}^{(k-1)}\right), \delta*{c s}^{(k)}\right)\right)
\]

The outer sum is over review histories. The inner sum is over review steps of a single review history; for each step, we consider only information available up to that point in time. In the inner sum, for \( k=1 \) the review history is empty.

A memory model is a probabilistic binary classifier. We are not only interested in classifying the next review as success or failure, we are also concerned about predicting the probability of the outcome. It is a regression task. We are performing a retrievability regression. What we care about is modeling how retrievability changes over time, so that we can pick a specific date at which the student should review a certain card. The task would be much more difficult with just a set of binary predictions. As we will see in Section 4.1 this framing leads to sensible metrics for comparing memory models.

We close the section with a few final remarks. In this thesis, we consider point predictions about retrievability; future work could explore prediction intervals and their implications for review schedulers. Moreover, future work might account for card interference. We have implicitly assumed local independence: the cards are not related to each other. The dependency between review histories of two or more cards covering the same concepts might be explored since reviewing one of them might influence the retrievability of the others. In the literature, memory models are sometimes referred to as student models. We prefer the former nomenclature because it is more specific. Student models are employed, for instance, in knowledge tracing, where binary events for correctness of an answer are also studied, but memory and forgetting are not necessarily taken into account. For example, see [30].

## 2.2. Limitations in modeling student's knowledge

Memory models for spaced repetition systems suffer from three main limitations due to the nature of the data available to us as developers of a spaced repetition system: the data we collect is sparse, fragile, and biased.

### The data is sparse

The memory model tries to capture the internal state of memory of the students. The state of memory is dynamic and very complex, each memory depends on other memories, new ideas and understanding are constantly generated, destroyed, and recreated in new forms. With the currently available tools, we cannot directly observe this state. What we can do is approximate a useful representation, limited to material covered by the cards that the student reviews. For each card and for each student, we observe a time-stamped binary sequence of review ratings: after reviewing a card, the student indicates whether the recall was successful or not. We know when a card was introduced to the student and whether he recalled it or not at certain points in time. This is a faint but useful signal into the complex and intertwined state of our memory. It is all we have. Mastery of a subject is dynamic, it is affected by learning and forgetting. We ask students questions and collect binary responses. We cannot expect to fully reconstruct the state of mastery from this little information.

### The data is fragile

The measurement itself messes with the memory state [3]. As a simple illustrative example, if the student successfully reviews a card, it is very likely that he also recalls it a few seconds later, independently of the initial uncertainty. Each review is fundamental to the memory model to predict future retrievability. If a single review data point went missing, we could be underestimating the retrievability for that item (or overestimating, depending on the time and rating of the review). This is what always happens though. Students do not live inside a crystal ball only interacting with the spaced repetition system. They live in a rich environment. Our hope is that the material they review plays an important role in their lives and that they interact with it outside the context of spaced repetition. Each and every time they do that it is an interaction we cannot capture with our system, but that possibly plays an important role in shaping the student's internal memory state. The real-world performance of a memory model is severely constrained by the information we can extract from the environment, which is limited just to the student's interactions with the spaced repetition system.

### The data is biased

Another important limitation is that spaced repetition systems suffer from a chicken or the egg problem: the memory model is fitted to the data, but the data collected is biased by the memory model. We want to fit an accurate memory model to the data collected from the system and then use this model to schedule reviews. The schedule will bias the future collected data, possibly impairing further optimization of the memory model. Some of the implications have been explored in [27].

However, not everything is lost; we will see how we can make good use of the available information. As we will see in Chapter 4 the memory models presented in the following and in Chapter 3 are able to make retrievability predictions that are better than chance and are often accurate. Not only that, many of those memory models have fairly interpretable dynamics that might allow us to glimpse the inner workings of memory. We do not only seek accurate prediction, a good memory model should also be a source of good explanations.

## 2.3. State of the art

This section provides a detailed report on the state of the art in the development of memory models. Since we are exploring memory models with the goal of employing them in a spaced repetition system, we only focus on adaptive memory models; we leave out of the discussion many important memory models that were not designed to account for interactions between students and cards.

### 2.3.1. 1PL-IRT

Our dataset contains reviews for different students and different cards. We can think of reviews as tests and employ the Item Response Theory (IRT) statistical framework to predict test responses for student-card pairs. The role of items in IRT is played by cards.

The drawback of this approach is that we are discarding time information, that is we are not accounting for forgetting. If the student does not review any card, the retrievability predicted from the model described below does not change over time.

We employ the simplest IRT model: 1PL-IRT. We cast the model in the Generalized Linear Mixed Models (GLMM) framework, following [4]. We have a linear component:

\[
\eta*{\theta}(s, c)=a*{s}-d\_{c}
\]

where \( \theta=\left\{a*{s}\right\}*{s \in \mathcal{S}} \cup\left\{d*{c}\right\}*{c \in \mathcal{C}} . a*{s} \sim \mathcal{N}\left(0, \sigma*{s}^{2}\right) \) are random effect parameters that represent student ability and \( d\_{c} \) are fixed effect parameters for card difficulty. Student ability does not necessarily capture the student's skills in the domain being studied. Student ability might capture other factors such as attitude towards the domain or towards spaced repetition in general.

The linear component \( \eta*{\theta} \) and \( p*{\theta} \) are related through the logit link function:

\[
\eta*{\theta}=\ln \left(\frac{p*{\theta}}{1-p\_{\theta}}\right)
\]

Finally, with \( \sigma(x)=(1+\exp (-x))^{-1} \) indicating the logistic function, we have:

\[
p*{\theta}(c, s)=\sigma\left(a*{s}-d\_{c}\right)
\]

By considering the student ability as a random effect, we assume that the students have been randomly and independently sampled from a larger population of students with probability distribution empirically approximated by our observed sample of students [43, Section 2.2.2]. In particular, we do not focus our attention on estimating the ability of every individual student in \( \mathcal{S} \). The same cannot be said for the difficulty of the card, as it is regarded as a fixed effect.

The model assumes local independence: independence between reviews by the same student. We note that our data does not satisfy this assumption. In particular, dependencies are induced by both the hierarchical structure (decks are made of cards) and the repeated reviews on the same card over time. In the present thesis, we ignore this problem. The problem can be tackled in future work, for instance, by introducing additional random effects representing the structure.

We do not consider 2PL-IRT or 3PL-IRT, since [21] found a negligible gain in predictive performance compared to 1PL-IRT when they are employed to model student memory.

### 2.3.2. DASH and variants

Lindsey et al. [21, 23] set out to build a model for personalized review that tracks the state of knowledge of each student and adapts to them. They did that by integrating psychological theory with big-data methods in a spirit that is very precious for the present thesis.

They present the DASH (Difficulty, Ability and Study History) model that, as in the framework of Section 2.1, relates retrievability to three factors: card difficulty, student ability, and review history for a card-student pair. The elapsed times between reviews in the card history enter the model through several time windows \( W \). We pick \( W=\{1,7,30, \infty\} \) days; we follow the choice in [21] but drop the hour time window, since we use a day resolution. The model predicts retrievability as

\[
p*{\theta}\left(c, s,\left(r^{(1)}, \ldots, r^{(k)}\right), \delta\right)=\sigma\left(a*{s}-d*{c}+\sum*{w=1}^{|W|} \theta*{2 w-1} \ln \left(1+c*{w}\right)+\theta*{2 w} \ln \left(1+n*{w}\right)\right)
\]

where \( a*{s} \) and \( d*{c} \) are parameters for, respectively, the ability of the student \( s \in \mathcal{S} \) and the difficulty of the card \( c \in \mathcal{C} \), as for the 1PL-IRT model of Section 2.3.1. \( c*{w} \) is the number of times the student \( s \) correctly recalled card \( c \) in window \( W*{w} \) out of \( n*{w} \) attempts. \( \left\{\theta*{1}, \ldots, \theta*{2|W|}\right\} \) are window-specific parameters. The parameters are \( \theta=\left\{a*{s}\right\}_{s \in \mathcal{S}} \cup\left\{d_{c}\right\}_{c \in \mathcal{C}} \cup \left\{\theta_{1}, \ldots, \theta*{2|W|}\right\} \). Using the notation \( \delta^{(i: j)}=\sum*{h=i}^{j} \delta^{(h)} \):

\[
\begin{aligned}
c*{w}\left(\left(r^{(1)}, \ldots, r^{(k)}\right), \delta\right) & =\sum*{i=1}^{k} \mathbb{I}_{\left[0, W_{w}\right]}\left(\delta+\delta^{(i+1: k)}\right) y^{(i)} \\
n*{w}\left(\left(r^{(1)}, \ldots, r^{(k)}\right), \delta\right) & =\sum*{i=1}^{k} \mathbb{I}_{\left[0, W_{w}\right]}\left(\delta+\delta^{(i+1: k)}\right)
\end{aligned}
\]

\( \delta+\delta^{(i+1: k)} \) represents the time that elapsed between now and the \( i \)-th review of the history (assuming \( \delta \) represents the elapsed time between now and the last review of the history).

The forgetting curve after one or more reviews is a step-function. As time elapses, fewer and fewer reviews of the history are included in the time windows, retrievability eventually reaches a constant positive level that depends on \( a*{s}, d*{c} \) (and eventually window parameters if a time window of infinite length is included, as happens in [21] and as we replicate for the comparison of Chapter 4). Examples of DASH forgetting curves are reported in Figure 2.1.

![Figure 2.1: Examples of DASH forgetting curves](data:image/png;base64,...)

_Figure 2.1: Examples of DASH forgetting curves. We sampled a student and a card from the first train-test sample of Section 4.3 and simulated three review histories of two reviews each, the details are reported in the figure's legend. For each review history, we fit a DASH memory model \( \hat{p}\_{\theta} \) and plot the predicted retrievability as a function of the time \( \delta \) elapsed since the last of the two reviews._

DASH was originally presented as part of a more general framework:

\[
p*{\theta}\left(c, s,\left(r^{(1)}, \ldots, r^{(k)}\right), \delta\right)=\sigma\left(a*{s}-d*{c}+h*{\theta}\left(\left(r^{(1)}, \ldots, r^{(k)}\right), \delta\right)\right)
\]

The dependence of retrievability on the review history is isolated by the function \( h*{\theta} \). Notice how 1PL-IRT is an example of this general framework with \( h*{\theta}=0 \).

They present two more instances of this framework, inspired by psychological theory: DASH[MCM] inspired by the Multiscale Context Model (MCM) [29] and DASH[ACT-R] inspired by the memory module in the ACT-R cognitive architecture.

In DASH[MCM] the counts \( c*{w} \) and \( n*{w} \) decay over time at a window-specific rate \( \tau*{w} \) (fixed a priori). As in the choice of \( W \), we fix the decay rates similarly to the original paper, as \( \tau*{1: W}=\{0.2434,1.9739,16.0090,129.8426\} \) [21]. In Equation 2.6 \( c*{w} \) and \( n*{w} \) are replaced with

\[
\begin{aligned}
& c*{w}\left(\left(r^{(1)}, \ldots, r^{(k)}\right), \delta\right)=\sum*{i=1}^{k} \mathbb{I}_{\left[0, W_{w}\right]}\left(\delta+\delta^{(i+1: k)}\right) e^{-\left(\delta+\delta^{(i+1: k)}\right) / \tau*{w}} y^{(i)} \\
& n*{w}\left(\left(r^{(1)}, \ldots, r^{(k)}\right), \delta\right)=\sum*{i=1}^{k} \mathbb{I}*{\left[0, W_{w}\right]}\left(\delta+\delta^{(i+1: k)}\right) e^{-\left(\delta+\delta^{(i+1: k)}\right) / \tau\_{w}}
\end{aligned}
\]

In DASH[ACT-R] we have:

\[
h*{\theta}\left(\left(r^{(1)}, \ldots, r^{(k)}\right), \delta\right)=\theta*{1} \ln \left(1+\sum*{i=1}^{k} \theta*{3+y^{(i)}}\left(\delta+\delta^{(i+1: k)}\right)^{-\theta\_{2}}\right)
\]

Only in DASH[ACT-R] \( h\_{\theta} \) is not linear in \( \theta \). Information on how we fit the models for the experiment in Chapter 4 is provided in Section 4.2. In Figures 2.2, 2.4, we show examples of DASH[MCM] and DASH[ACT-R] forgetting curves.

![Figure 2.2: Examples of DASH[MCM] forgetting curves](data:image/png;base64,...)

_Figure 2.2: Examples of DASH[MCM] forgetting curves. We proceed as in Figure 2.1, with the same student and card._

![Figure 2.3: Examples of DASH[ACT-R] forgetting curves](data:image/png;base64,...)

_Figure 2.3: Examples of DASH[ACT-R] forgetting curves. We proceed as in Figure 2.1, with the same student and card._

Choffin et al. [8] introduce a new model: DAS3H. DAS3H extends DASH by introducing multiple-skills tagging. Each card is tagged with one or more skills required to answer correctly. The memory dynamics are then allowed to differ between skills. In our experience skills data is hard to come by in spaced repetition systems, in particular, in the datasets considered in Chapter 4 we do not have that kind of data and so we exclude DAS3H from the comparison.

### 2.3.3. Half-Life Regression

Half-life regression (HLR) is a memory model designed for learning language vocabulary with spaced repetition [36], we adapt it to a more general setting. In the original model each card regards a word. Words are tagged by lexeme, these lexeme tags are taken into account when predicting the retrievability of words.

HLR assumes an exponential forgetting curve of the form:

\[
p*{\theta}(\delta)=2^{-\frac{\delta}{h*{\theta}}}
\]

where \( h*{\theta} \) is called half-life. Compared to Equation 1.1 the base of the exponential changes and \( h*{\theta} \) is stability up to a constant factor, so the discussion in Section 1.2.2 applies.

The half-life depends on the scalar product of the weights \( \theta \) and a feature vector. Here, we report the shape of the feature vector employed in the comparison of Chapter 4 which tries to be as faithful as possible to the original paper, but is inevitably constrained by the lack of word-specific information:

\[
h*{\theta}\left(c, s,\left(r^{(1)}, \ldots, r^{(k)}\right)\right)=2^{\theta*{1} \sqrt{1+\sum*{i=1}^{k} y*{i}}+\theta*{2} \sqrt{1+\sum*{i=1}^{k}\left(1-y*{i}\right)+\theta*{c}+\theta\_{s}}}
\]

In the original model the predictors are enhanced with additional indicator variables, one for each lexeme tag considered. The set of weights \( \theta \) is empirically fit to review data by minimizing the following loss function.

\[
\ell\left(y, p*{\theta}(\delta)\right)=\left(y-p*{\theta}(\delta)\right)^{2}+\lambda\|\theta\|\_{2}^{2}
\]

where \( \lambda \) is a hyperparameter. In the original paper the loss contains an additional term for the squared deviation of \( h*{\theta} \) to the observed half-life \( \frac{-t}{\log *{2} p\_{\theta}} \), the computation of the latter is possible because they consider review ratings in the interval \([0,1]\), instead of binary review ratings.

![Figure 2.4: Examples of HLR forgetting curves](data:image/png;base64,...)

_Figure 2.4: Examples of HLR forgetting curves. We proceed as in Figure 2.1, with the same student and card._

They fit the model on a large dataset (containing more than 12 million observations) consisting of two weeks of log data from the popular Duolingo language learning app. They employ gradient descend.

In this thesis, we are not assuming any specific learning domain; HLR can still be applied by dropping the word features. The fairness of the comparison of Chapter 4 might be compromised; we argue that it is not the case since other models could similarly be enhanced with lexeme tags if available.

### 2.3.4. SuperMemo Algorithm SM-17 and SM-18

Piotr Wozniak, along with the SuperMemo World company, has been developing the SuperMemo software (https://www.supermemo.com) for three decades. SuperMemo is the first spaced repetition system and one that still serves millions of students. SuperMemo and the literature on review schedulers developed in parallel, as far as we know the recent SuperMemo algorithms have not been considered in the literature. One of the goals of this thesis is to fill this gap; the SuperMemo algorithms are potential sources of invaluable insights for the development of memory models and on the inner workings of memory. An account of the history of the SuperMemo algorithms can be found in [46].

SuperMemo Algorithm SM-18 (SM-18) [48] is the review scheduler used in SuperMemo since 2019. In this section, we focus mainly on its predecessor SuperMemo Algorithm SM-17 (SM-17) [47], which has been a great improvement over previous versions of the algorithm, and is of significant importance for the developments of Chapter 3. The improvement of SM-18 over SM-17 is not as large; we briefly discuss the differences between the two at the end of the section. Previous versions of the SuperMemo Algorithm were largely heuristic in nature, the significance of SM-17 is that, in contrast, the algorithm is based on psychology results and can now learn and adapt to any review history, much in the spirit of [23].

SM-17 is described on the web page [47], but many important details are missing that prevent a faithful reproduction of the algorithm. That is why we do not include SM-17 in the comparison of Chapter 4. SM-17 is a review scheduler, but we can isolate the memory model component. Here we try to summarize some of its aspects that are important for the development of Chapter 3.

SM-17 is based on the two components description of memory of Section 1.2.1, besides retrievability SM-17 explicitly models stability and its dynamics as the student reviews a card. Moreover, card difficulty is taken into account. The core idea is to model memory with forgetting curves, which we described in Section 1.2.2. They employ an exponential forgetting curve (Equation 1.1) to describe the decline in retrievability over time at a rate determined by stability.

We need a few definitions. For the remainder of the section we focus on a single review history, therefore fix a card \( c \in \mathcal{C} \) and a student \( s \in \mathcal{S} \). Let \( r^{(1)}, \ldots, r^{(K)} \) be the review history of length \( K \) of \( c \) by \( s \). Denote by \( p^{(i)} \) the retrievability estimate before the \( i \)-th review, \( p^{(i)}(\delta)=p*{\theta}\left(c, s,\left(r^{(1)}, \ldots, r^{(i-1)}\right), \delta\right) \) is the retrievability \( \delta \) days after the \( i-1 \)-th review. Note that the review history can be empty. Below we recursively define \( s^{(i)} \), the stability before the \( i \)-th review. It represents the interval of time after which a theoretical retrievability estimate obtained with the exponential forgetting curve falls below \( 90 \% \). In addition to retrievability and stability, a third variable is introduced: difficulty \( d*{c} \in [0,1] \) for the card \( c \in \mathcal{C} \). It is defined as the maximum possible increase in stability for the card \( c \) linearly mapped to the interval \([0,1]\). We omit the computation of card difficulty from the discussion, since it is not relevant to the developments of Chapter 3. Since earlier we fixed the card \( c \in \mathcal{C} \), we dropped the related index, \( d=d*{c} \). Finally, let \( l^{(i)}=\sum*{j=1}^{i}\left(1-y^{(j)}\right) \) be the number of lapses up to and including review \( i \), lapse is just another name for an incorrect review. Notice that before the instant of time in which the student rates the \( i \)-th review \( \delta^{(i)}, s^{(i)}, \) and \( p^{(i)} \) are known (as well as all previous reviews in the history); \( y^{(i)} \) and \( l^{(i)} \) are not known, they will be available only after the student rates the card; our goal is to compute \( p^{(i)} \) before observing \( y^{(i)} \), before the student rates the card.

To model the dynamics of memory, SM-17 uses three functions: stability increase function, first post-lapse stability function, and recall function. We discuss each of them below:

- The stability increase function \( S*{I n c}(p, s, d) \) depends on retrievability \( p \), stability \( s \), and difficulty \( d \), it determines how stability changes after a successful review. If the review \( i-1 \) is successful \( \left(y^{(i-1)}=1\right) \), then \( s^{(i)}=s^{(i-1)} S*{I n c}\left(p^{(i-1)}\left(\delta^{(i-1)}\right), s^{(i-1)}, d\right) \). \( p^{(i-1)}\left(\delta^{(i-1)}\right) \) is the retrievability estimate right before the review \( i-1 \) is rated.
- The first post-lapse stability function \( \operatorname{PLS}(l, p) \) depends on the number of lapses \( l \) and retrievability \( p \), it determines the stability after a lapse. If the review \( i-1 \) is unsuccessful \( \left(y^{(i-1)}=0\right) \), then \( s^{(i)}=\operatorname{PLS}\left(l^{(i-1)}, p^{(i-1)}\left(\delta^{(i-1)}\right)\right) \).
- The recall function \( \operatorname{Recall}(p, s, d) \) depends on an estimate of retrievability \( p \), stability \( s \), and difficulty \( d \), and is used to correct a theoretical estimate of retrievability. Given the stability \( s^{(i)} \), a theoretical estimate of retrievability is computed based on the exponential forgetting curve formula of Equation 1.1: \( p*{f c}^{(i)}(\delta)= \exp \left(\ln (0.9) \delta / s^{(i)}\right) \). Retrievability \( \delta \) days after review \( i-1 \) is finally computed as \( p^{(i)}(\delta)=\operatorname{Recall}\left(p*{f c}^{(i)}(\delta), s^{(i)}, d\right) \).

The memory model \( p*{\theta} \) is built iteratively, at each review step we compute stability using the functions \( S*{I n c} \) and \( P L S \), then the exponential forgetting curve gives us an estimate of retrievability that we correct with the function Recall. Information about the shape of the three functions or about how they are fitted is not provided by SuperMemo. We remark that the retrievability and stability estimates in SM-17 are more refined compared to the present description; what we have reported is a summary of the information we consider important for the developments of Chapter 3, more information is available in [47].

To model retrievability at any point in time, we miss a final ingredient: the startup stability \( s^{(1)} \), which determines the stability for newly introduced cards, before they are reviewed by the student. Finally, we can put everything together. Let us start from the first review step. As a card of difficulty \( d \) is introduced to the student, we assign stability \( s^{(1)} \). The student reviews the card at time \( \delta^{(1)} \). Before observing the rating \( y^{(1)} \) we can compute the retrievability estimate \( p^{(1)}\left(\delta^{(1)}\right)=\operatorname{Recall}\left(p*{f c}^{(1)}\left(\delta^{(1)}\right), s^{(1)}, d\right) \). We then observe \( y^{(1)} \) and compute the stability \( s^{(2)}=y^{(1)} s^{(1)} S*{I n c}\left(p^{(1)}\left(\delta^{(1)}\right), s^{(1)}, d\right)+(1-y^{(1)}) \operatorname{PLS}\left(l^{(1)}, p^{(1)}\left(\delta^{(1)}\right)\right) \). Now, again, thanks to the Recall function we obtain \( p^{(2)}(\delta) \) and we can iterate the whole process for any future review.

We left out the discussion on how difficulty is computed; we only remark that the main difference between SM-18 and SM-17 lies here. The card difficulty is estimated from the data; in the older version, it is assumed constant, while in the newer version, it is allowed to change in the course of learning.
